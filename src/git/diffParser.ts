import { DiffHunk, FileDiff, DeletedGroup, ModifiedPair } from '../types';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Minimum normalized Levenshtein ratio for a deletion+addition pair to be
 * treated as a modification. Below this we treat them as unrelated (a deleted
 * line and a separate added line). Tuned so that an extended comment pairs
 * with its original even when ~half the new line is brand-new text.
 */
const SIMILARITY_THRESHOLD = 0.3;

type TaggedLine =
  | { prefix: ' '; content: string; oldLine: number; newLine: number }
  | { prefix: '-'; content: string; oldLine: number }
  | { prefix: '+'; content: string; newLine: number };

export function parseDiff(rawDiff: string): FileDiff {
  const hunks: DiffHunk[] = [];
  const addedLines: number[] = [];
  const deletedGroups: DeletedGroup[] = [];
  const modifiedPairs: ModifiedPair[] = [];

  if (!rawDiff.trim()) {
    return { hunks, addedLines, deletedGroups, modifiedPairs };
  }

  const lines = rawDiff.split('\n');
  let i = 0;

  // Skip file header lines (diff --git, index, ---, +++)
  while (i < lines.length && !HUNK_HEADER.test(lines[i])) {
    i++;
  }

  while (i < lines.length) {
    const match = HUNK_HEADER.exec(lines[i]);
    if (!match) {
      i++;
      continue;
    }

    const hunk: DiffHunk = {
      oldStart: parseInt(match[1], 10),
      oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
      newStart: parseInt(match[3], 10),
      newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
      changes: [],
    };

    i++;

    // Collect raw hunk lines until the next hunk header.
    const rawHunkLines: { prefix: string; content: string }[] = [];
    while (i < lines.length && !HUNK_HEADER.test(lines[i])) {
      const line = lines[i];
      if (line.startsWith('+')) {
        rawHunkLines.push({ prefix: '+', content: line.substring(1) });
      } else if (line.startsWith('-')) {
        rawHunkLines.push({ prefix: '-', content: line.substring(1) });
      } else if (line.startsWith(' ')) {
        rawHunkLines.push({ prefix: ' ', content: line.substring(1) });
      }
      // Skip '\ No newline at end of file' and blank trailing lines
      i++;
    }

    // Tag each line with its 1-indexed line number in old/new files.
    const tagged: TaggedLine[] = [];
    {
      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;
      for (const hl of rawHunkLines) {
        if (hl.prefix === ' ') {
          tagged.push({ prefix: ' ', content: hl.content, oldLine, newLine });
          oldLine++;
          newLine++;
        } else if (hl.prefix === '-') {
          tagged.push({ prefix: '-', content: hl.content, oldLine });
          oldLine++;
        } else {
          tagged.push({ prefix: '+', content: hl.content, newLine });
          newLine++;
        }
      }
    }

    // Build hunk.changes in diff order — the head-to-working-tree translator
    // depends on this ordering to advance old/new line counters in sync.
    for (const t of tagged) {
      if (t.prefix === ' ') {
        hunk.changes.push({ type: 'context', oldLineNumber: t.oldLine, newLineNumber: t.newLine, content: t.content });
      } else if (t.prefix === '-') {
        hunk.changes.push({ type: 'delete', oldLineNumber: t.oldLine, content: t.content });
      } else {
        hunk.changes.push({ type: 'add', newLineNumber: t.newLine, content: t.content });
      }
    }

    // Hunk-wide modification pairing: match each deletion to its best-similar
    // addition (greedy, highest score first). Adjacency alone is unreliable —
    // git diff can put a deletion next to an unrelated addition just because
    // both happened at the same position in the hunk.
    const deletions: { content: string; oldLine: number; idx: number }[] = [];
    const additions: { content: string; newLine: number; idx: number }[] = [];
    for (let k = 0; k < tagged.length; k++) {
      const t = tagged[k];
      if (t.prefix === '-') deletions.push({ content: t.content, oldLine: t.oldLine, idx: k });
      else if (t.prefix === '+') additions.push({ content: t.content, newLine: t.newLine, idx: k });
    }

    type Candidate = { delIdx: number; addIdx: number; score: number };
    const candidates: Candidate[] = [];
    for (let di = 0; di < deletions.length; di++) {
      for (let ai = 0; ai < additions.length; ai++) {
        const score = lineSimilarity(deletions[di].content, additions[ai].content);
        if (score >= SIMILARITY_THRESHOLD) {
          candidates.push({ delIdx: di, addIdx: ai, score });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);

    const pairedDel = new Set<number>();
    const pairedAdd = new Set<number>();
    for (const c of candidates) {
      if (pairedDel.has(c.delIdx) || pairedAdd.has(c.addIdx)) continue;
      pairedDel.add(c.delIdx);
      pairedAdd.add(c.addIdx);
      const del = deletions[c.delIdx];
      const add = additions[c.addIdx];
      modifiedPairs.push({
        newLine: add.newLine - 1, // 0-indexed
        oldContent: del.content,
        newContent: add.content,
      });
    }

    // Unpaired additions become pure added lines.
    for (let ai = 0; ai < additions.length; ai++) {
      if (!pairedAdd.has(ai)) {
        addedLines.push(additions[ai].newLine - 1);
      }
    }

    // Unpaired deletions: group consecutive ones (in diff order) and anchor
    // each group to the most recent new-file line preceding it.
    let groupBuf: string[] = [];
    let groupAnchor0 = Math.max(0, hunk.newStart - 2); // 0-indexed line just before hunk
    let lastNewLine0 = hunk.newStart - 2;

    const flushGroup = () => {
      if (groupBuf.length === 0) return;
      deletedGroups.push({
        anchorLine: Math.max(0, groupAnchor0),
        lines: groupBuf,
      });
      groupBuf = [];
    };

    for (let k = 0; k < tagged.length; k++) {
      const t = tagged[k];
      if (t.prefix === ' ' || t.prefix === '+') {
        flushGroup();
        lastNewLine0 = t.newLine - 1;
      } else {
        const delIdx = deletions.findIndex(d => d.idx === k);
        if (pairedDel.has(delIdx)) {
          flushGroup();
          continue;
        }
        if (groupBuf.length === 0) {
          groupAnchor0 = Math.max(0, lastNewLine0);
        }
        groupBuf.push(t.content);
      }
    }
    flushGroup();

    hunks.push(hunk);
  }

  return { hunks, addedLines, deletedGroups, modifiedPairs };
}

/**
 * Normalized Levenshtein similarity in [0, 1]. Identical strings = 1; entirely
 * different = 0. Compares trimmed content so indentation changes don't bias
 * the score.
 */
function lineSimilarity(a: string, b: string): number {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return 1;
  if (x.length === 0 || y.length === 0) return 0;
  const maxLen = Math.max(x.length, y.length);
  // Fast reject: if the length disparity alone makes the best-possible ratio
  // fall below the threshold, skip the Levenshtein compute.
  if (Math.min(x.length, y.length) / maxLen < SIMILARITY_THRESHOLD) return 0;
  const distance = levenshtein(x, y);
  return 1 - distance / maxLen;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
