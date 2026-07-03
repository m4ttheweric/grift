import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { parseDiff } from '../git/diffParser';
import { DecorationTypes } from './decorationTypes';
import { DeletionHoverProvider } from '../ui/deletionHoverProvider';
import { DeletionCommentsProvider, RemovalThreadInput } from '../ui/deletionCommentsProvider';
import { DiffBaseMode, DiffHunk, DeletedGroup } from '../types';
import { getConfig } from '../config';

export class DecorationManager {
  private decorationTypes: DecorationTypes;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  showUncommittedOverlay: boolean;
  showInlineRemovals = false;

  constructor(
    private gitService: GitService,
    private hoverProvider: DeletionHoverProvider,
    private commentsProvider: DeletionCommentsProvider,
  ) {
    const config = getConfig();
    this.decorationTypes = new DecorationTypes(config.theme);
    this.showUncommittedOverlay = config.showUncommittedOverlayByDefault;
  }

  async updateDecorations(editor: vscode.TextEditor, mode: DiffBaseMode, branchName?: string): Promise<{ added: number; deleted: number; modified: number }> {
    const filePath = editor.document.uri.fsPath;
    const relativePath = this.gitService.getRelativePath(filePath);
    if (!relativePath) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const ref = await this.gitService.resolveRef(mode, branchName);
    if (!ref) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    // Committed diff: ref..HEAD. Line numbers in this diff are HEAD-space, so
    // we have to translate them into working-tree-space (what the editor shows)
    // before rendering — otherwise any uncommitted edit shifts every decoration.
    const rawDiff = await this.gitService.getDiffForFile(ref, relativePath);
    if (!rawDiff) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const diff = parseDiff(rawDiff);

    // Working-tree-vs-HEAD diff drives both the line translator and the
    // optional uncommitted overlay. Fetch it once, parse it once.
    const rawWtVsHead = await this.gitService.getDiffForFile('HEAD', relativePath, true);
    const wtVsHead = rawWtVsHead ? parseDiff(rawWtVsHead) : null;
    const translate = wtVsHead && wtVsHead.hunks.length > 0
      ? makeHeadToWorkingTreeTranslator(wtVsHead.hunks)
      : (line: number) => line;

    const lastLine = editor.document.lineCount - 1;

    // De-dupe added lines: when the user uncommitted-deletes a committed-added
    // range, several HEAD lines collapse onto the same WT line.
    const translatedAddedLines = Array.from(new Set(
      diff.addedLines.map(translate).filter(line => line >= 0 && line <= lastLine),
    ));
    // Clamp and merge up front so decorations, comment threads, hover lookups,
    // and stats all agree on which line a group lives on... translation can
    // land several groups on the same clamped anchor.
    const translatedDeletedGroups = clampAndMergeGroups(
      diff.deletedGroups.map(g => ({ ...g, anchorLine: translate(g.anchorLine) })),
      lastLine,
    );
    const uncommittedDeletedGroups = wtVsHead
      ? clampAndMergeGroups(wtVsHead.deletedGroups, lastLine)
      : [];
    const translatedModifiedPairs = diff.modifiedPairs
      .map(p => ({ ...p, newLine: translate(p.newLine) }))
      .filter(p => p.newLine >= 0 && p.newLine <= lastLine);

    const spacerDecorations: vscode.DecorationOptions[] = [];
    for (let i = 0; i <= lastLine; i++) {
      spacerDecorations.push({ range: new vscode.Range(i, 0, i, 0) });
    }
    editor.setDecorations(this.decorationTypes.spacer, spacerDecorations);

    // Committed decorations
    const addedDecorations: vscode.DecorationOptions[] = translatedAddedLines
      .map(line => ({ range: new vscode.Range(line, 0, line, 0) }));

    const modifiedDecorations: vscode.DecorationOptions[] = translatedModifiedPairs
      .map(pair => ({ range: new vscode.Range(pair.newLine, 0, pair.newLine, 0) }));

    // When inline mode is ON, the deletion content is rendered as a comment
    // thread (which actually grows the editor line). The "-N" decoration is
    // suppressed so we don't double-mark.
    const deletedDecorations: vscode.DecorationOptions[] = this.showInlineRemovals
      ? []
      : translatedDeletedGroups.map(deletionBadge);

    editor.setDecorations(this.decorationTypes.added, addedDecorations);
    editor.setDecorations(this.decorationTypes.modified, modifiedDecorations);
    editor.setDecorations(this.decorationTypes.deleted, deletedDecorations);

    // Uncommitted overlay — reuse the parsed wtVsHead diff
    if (this.showUncommittedOverlay && wtVsHead) {
      editor.setDecorations(
        this.decorationTypes.addedUncommitted,
        wtVsHead.addedLines
          .filter(line => line <= lastLine)
          .map(line => ({ range: new vscode.Range(line, 0, line, 0) })),
      );
      editor.setDecorations(
        this.decorationTypes.modifiedUncommitted,
        wtVsHead.modifiedPairs
          .filter(pair => pair.newLine <= lastLine)
          .map(pair => ({ range: new vscode.Range(pair.newLine, 0, pair.newLine, 0) })),
      );
      editor.setDecorations(
        this.decorationTypes.deletedUncommitted,
        this.showInlineRemovals ? [] : uncommittedDeletedGroups.map(deletionBadge),
      );
    } else {
      this.clearUncommittedOverlay(editor);
    }

    // Comment-thread inline rendering for deletions
    if (this.showInlineRemovals) {
      const threadInputs: RemovalThreadInput[] = [
        ...translatedDeletedGroups.map(g => ({
          anchorLine: g.anchorLine,
          lines: g.lines,
          label: `${g.lines.length} line${g.lines.length === 1 ? '' : 's'} removed`,
        })),
        ...(this.showUncommittedOverlay ? uncommittedDeletedGroups : []).map(g => ({
          anchorLine: g.anchorLine,
          lines: g.lines,
          label: `${g.lines.length} line${g.lines.length === 1 ? '' : 's'} removed (uncommitted)`,
        })),
      ];
      this.commentsProvider.update(editor.document.uri, threadInputs, editor.document.languageId);
    } else {
      this.commentsProvider.clear(editor.document.uri.toString());
    }

    this.hoverProvider.update(editor.document.uri.toString(), translatedDeletedGroups, translatedModifiedPairs);

    return {
      added: translatedAddedLines.length,
      deleted: translatedDeletedGroups.reduce((sum, g) => sum + g.lines.length, 0),
      modified: translatedModifiedPairs.length,
    };
  }

  private clearUncommittedOverlay(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationTypes.addedUncommitted, []);
    editor.setDecorations(this.decorationTypes.modifiedUncommitted, []);
    editor.setDecorations(this.decorationTypes.deletedUncommitted, []);
  }

  clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationTypes.spacer, []);
    editor.setDecorations(this.decorationTypes.added, []);
    editor.setDecorations(this.decorationTypes.modified, []);
    editor.setDecorations(this.decorationTypes.deleted, []);
    this.clearUncommittedOverlay(editor);
    this.hoverProvider.clear(editor.document.uri.toString());
    this.commentsProvider.clear(editor.document.uri.toString());
  }

  debounceUpdate(editor: vscode.TextEditor, mode: DiffBaseMode, callback?: (stats: { added: number; deleted: number; modified: number }) => void, branchName?: string) {
    // One timer per document... a burst of saves across different files must
    // not cancel each other's pending updates.
    const key = editor.document.uri.toString();
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(key, setTimeout(async () => {
      this.debounceTimers.delete(key);
      const stats = await this.updateDecorations(editor, mode, branchName);
      callback?.(stats);
    }, 300));
  }

  recreateDecorationTypes() {
    this.decorationTypes.dispose();
    this.decorationTypes = new DecorationTypes(getConfig().theme);
  }

  dispose() {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    this.decorationTypes.dispose();
  }
}

function clampAndMergeGroups(groups: DeletedGroup[], lastLine: number): DeletedGroup[] {
  const byAnchor = new Map<number, string[]>();
  for (const group of groups) {
    const anchor = Math.max(0, Math.min(group.anchorLine, lastLine));
    const lines = byAnchor.get(anchor);
    if (lines) {
      lines.push(...group.lines);
    } else {
      byAnchor.set(anchor, [...group.lines]);
    }
  }
  return [...byAnchor.entries()].map(([anchorLine, lines]) => ({ anchorLine, lines }));
}

function deletionBadge(group: DeletedGroup): vscode.DecorationOptions {
  return {
    range: new vscode.Range(group.anchorLine, 0, group.anchorLine, 0),
    renderOptions: {
      before: {
        contentText: `-${group.lines.length}`,
        color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
        backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
        margin: '0 4px 0 -1ch',
      },
    },
  };
}

/**
 * Maps a 0-indexed HEAD line number to its 0-indexed working-tree line number,
 * given the hunks of `git diff HEAD -- <file>`.
 *
 * A hunk's `oldCount` covers context AND deletions, not just deletions. Pure
 * insertions in the middle of context (e.g. user adds one line in a function)
 * produce hunks whose `oldCount` is entirely context — those context lines
 * must pass through with the cumulative offset of preceding hunks, NOT be
 * remapped to the hunk's new range. So we walk each hunk's per-line `changes`
 * to record a precise mapping for every HEAD line touched, and fall back to
 * cumulative offsets for HEAD lines that fall between hunks.
 */
function makeHeadToWorkingTreeTranslator(hunks: DiffHunk[]): (headLine0: number) => number {
  type HunkInfo = {
    oldStart0: number;
    oldEnd0: number;
    innerMap: Map<number, number>;
    cumOffsetAfter: number;
  };
  const infos: HunkInfo[] = [];
  let cumOffset = 0;
  for (const h of hunks) {
    const oldStart0 = h.oldStart - 1;
    const oldEnd0 = oldStart0 + h.oldCount;
    const innerMap = new Map<number, number>();
    let oldLine = h.oldStart;
    let newLine = h.newStart;
    for (const c of h.changes) {
      if (c.type === 'context') {
        innerMap.set(oldLine - 1, newLine - 1);
        oldLine++;
        newLine++;
      } else if (c.type === 'add') {
        newLine++;
      } else {
        // delete: map deleted HEAD line to the next existing WT line.
        innerMap.set(oldLine - 1, Math.max(0, newLine - 1));
        oldLine++;
      }
    }
    cumOffset += h.newCount - h.oldCount;
    infos.push({ oldStart0, oldEnd0, innerMap, cumOffsetAfter: cumOffset });
  }
  return (headLine0) => {
    let priorOffset = 0;
    for (const info of infos) {
      if (headLine0 < info.oldStart0) {
        return headLine0 + priorOffset;
      }
      if (headLine0 < info.oldEnd0) {
        const mapped = info.innerMap.get(headLine0);
        return mapped !== undefined ? mapped : headLine0 + priorOffset;
      }
      priorOffset = info.cumOffsetAfter;
    }
    return headLine0 + priorOffset;
  };
}
