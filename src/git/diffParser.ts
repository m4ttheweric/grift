import { DiffHunk, LineChange, FileDiff, DeletedGroup, ModifiedPair } from '../types';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

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
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    // Collect all lines in this hunk
    const hunkLines: { prefix: string; content: string }[] = [];
    while (i < lines.length && !HUNK_HEADER.test(lines[i])) {
      const line = lines[i];
      if (line.startsWith('+')) {
        hunkLines.push({ prefix: '+', content: line.substring(1) });
      } else if (line.startsWith('-')) {
        hunkLines.push({ prefix: '-', content: line.substring(1) });
      } else if (line.startsWith(' ')) {
        hunkLines.push({ prefix: ' ', content: line.substring(1) });
      } else if (line === '\\ No newline at end of file') {
        // skip
      } else if (line === '') {
        // Could be end of diff or empty context line — only treat as context if we're still within hunk bounds
        if (i + 1 < lines.length && (lines[i + 1]?.startsWith('+') || lines[i + 1]?.startsWith('-') || lines[i + 1]?.startsWith(' ') || HUNK_HEADER.test(lines[i + 1]))) {
          // empty line at end before next hunk or more changes — skip
        }
      }
      i++;
    }

    // Process hunk lines: detect modification pairs
    let j = 0;
    while (j < hunkLines.length) {
      const hl = hunkLines[j];

      if (hl.prefix === ' ') {
        // Context line
        hunk.changes.push({ type: 'context', oldLineNumber: oldLine, newLineNumber: newLine, content: hl.content });
        oldLine++;
        newLine++;
        j++;
      } else if (hl.prefix === '-') {
        // Collect consecutive deletions
        const deletions: { content: string; oldLineNum: number }[] = [];
        while (j < hunkLines.length && hunkLines[j].prefix === '-') {
          deletions.push({ content: hunkLines[j].content, oldLineNum: oldLine });
          oldLine++;
          j++;
        }

        // Check for immediately following additions (modifications)
        const additions: { content: string; newLineNum: number }[] = [];
        while (j < hunkLines.length && hunkLines[j].prefix === '+') {
          additions.push({ content: hunkLines[j].content, newLineNum: newLine });
          newLine++;
          j++;
        }

        // Pair deletions with additions as modifications
        const pairCount = Math.min(deletions.length, additions.length);
        for (let k = 0; k < pairCount; k++) {
          modifiedPairs.push({
            newLine: additions[k].newLineNum - 1, // 0-indexed
            oldContent: deletions[k].content,
            newContent: additions[k].content,
          });
          hunk.changes.push({ type: 'delete', oldLineNumber: deletions[k].oldLineNum, content: deletions[k].content });
          hunk.changes.push({ type: 'add', newLineNumber: additions[k].newLineNum, content: additions[k].content });
        }

        // Remaining unpaired deletions → deleted group
        if (deletions.length > pairCount) {
          const remainingDeleted = deletions.slice(pairCount);
          // newLine (1-indexed) points to the first new-file line after the deletion.
          // Subtract 2 to get the last line before the deletion in 0-indexed editor coordinates.
          const anchorLine = newLine - 2;
          deletedGroups.push({
            anchorLine: Math.max(0, anchorLine),
            lines: remainingDeleted.map(d => d.content),
          });
          for (const d of remainingDeleted) {
            hunk.changes.push({ type: 'delete', oldLineNumber: d.oldLineNum, content: d.content });
          }
        }

        // Remaining unpaired additions → added lines
        if (additions.length > pairCount) {
          const remainingAdded = additions.slice(pairCount);
          for (const a of remainingAdded) {
            addedLines.push(a.newLineNum - 1); // 0-indexed
            hunk.changes.push({ type: 'add', newLineNumber: a.newLineNum, content: a.content });
          }
        }
      } else if (hl.prefix === '+') {
        // Pure addition (no preceding deletion)
        addedLines.push(newLine - 1); // 0-indexed
        hunk.changes.push({ type: 'add', newLineNumber: newLine, content: hl.content });
        newLine++;
        j++;
      } else {
        j++;
      }
    }

    hunks.push(hunk);
  }

  return { hunks, addedLines, deletedGroups, modifiedPairs };
}
