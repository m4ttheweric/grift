import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { parseDiff } from '../git/diffParser';
import { DecorationTypes } from './decorationTypes';
import { DeletionHoverProvider } from '../ui/deletionHoverProvider';
import { DiffBaseMode } from '../types';
import { getConfig } from '../config';

export class DecorationManager {
  private decorationTypes: DecorationTypes;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  showUncommittedOverlay = false;

  constructor(
    private gitService: GitService,
    private extensionPath: string,
    private hoverProvider: DeletionHoverProvider,
  ) {
    const config = getConfig();
    this.decorationTypes = new DecorationTypes(extensionPath, config.showGutterIcons);
  }

  async updateDecorations(editor: vscode.TextEditor, mode: DiffBaseMode): Promise<{ added: number; deleted: number; modified: number }> {
    const filePath = editor.document.uri.fsPath;
    const relativePath = this.gitService.getRelativePath(filePath);
    if (!relativePath) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const ref = await this.gitService.resolveRef(mode);
    if (!ref) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const rawDiff = await this.gitService.getDiffForFile(ref, relativePath, mode === 'branchHead');
    if (!rawDiff) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const diff = parseDiff(rawDiff);
    const lastLine = editor.document.lineCount - 1;

    // Spacer — one entry per line, keeps all lines at a consistent left indent
    const spacerDecorations: vscode.DecorationOptions[] = [];
    for (let i = 0; i <= lastLine; i++) {
      spacerDecorations.push({ range: new vscode.Range(i, 0, i, 0) });
    }
    editor.setDecorations(this.decorationTypes.spacer, spacerDecorations);

    // Committed decorations
    const addedDecorations: vscode.DecorationOptions[] = diff.addedLines
      .filter(line => line <= lastLine)
      .map(line => ({ range: new vscode.Range(line, 0, line, 0) }));

    const modifiedDecorations: vscode.DecorationOptions[] = diff.modifiedPairs
      .filter(pair => pair.newLine <= lastLine)
      .map(pair => ({ range: new vscode.Range(pair.newLine, 0, pair.newLine, 0) }));

    const deletedDecorations: vscode.DecorationOptions[] = diff.deletedGroups.map(group => {
      const line = Math.min(group.anchorLine, lastLine);
      return {
        range: new vscode.Range(line, 0, line, 0),
        renderOptions: {
          before: {
            contentText: `-${group.lines.length}`,
            color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
            backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
            margin: '0 0.5em 0 0',
          },
        },
      };
    });

    editor.setDecorations(this.decorationTypes.added, addedDecorations);
    editor.setDecorations(this.decorationTypes.modified, modifiedDecorations);
    editor.setDecorations(this.decorationTypes.deleted, deletedDecorations);

    // Uncommitted overlay — second diff against HEAD (working tree changes)
    if (this.showUncommittedOverlay && mode !== 'branchHead') {
      const rawUncommitted = await this.gitService.getDiffForFile('HEAD', relativePath, true);
      if (rawUncommitted) {
        const uncommittedDiff = parseDiff(rawUncommitted);

        editor.setDecorations(
          this.decorationTypes.addedUncommitted,
          uncommittedDiff.addedLines
            .filter(line => line <= lastLine)
            .map(line => ({ range: new vscode.Range(line, 0, line, 0) })),
        );
        editor.setDecorations(
          this.decorationTypes.modifiedUncommitted,
          uncommittedDiff.modifiedPairs
            .filter(pair => pair.newLine <= lastLine)
            .map(pair => ({ range: new vscode.Range(pair.newLine, 0, pair.newLine, 0) })),
        );
        editor.setDecorations(
          this.decorationTypes.deletedUncommitted,
          uncommittedDiff.deletedGroups.map(group => ({
            range: new vscode.Range(Math.min(group.anchorLine, lastLine), 0, Math.min(group.anchorLine, lastLine), 0),
          })),
        );
      } else {
        this.clearUncommittedOverlay(editor);
      }
    } else {
      this.clearUncommittedOverlay(editor);
    }

    this.hoverProvider.update(editor.document.uri.toString(), diff.deletedGroups, diff.modifiedPairs);

    return {
      added: diff.addedLines.length,
      deleted: diff.deletedGroups.reduce((sum, g) => sum + g.lines.length, 0),
      modified: diff.modifiedPairs.length,
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
  }

  debounceUpdate(editor: vscode.TextEditor, mode: DiffBaseMode, callback?: (stats: { added: number; deleted: number; modified: number }) => void) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const stats = await this.updateDecorations(editor, mode);
      callback?.(stats);
    }, 300);
  }

  recreateDecorationTypes() {
    this.decorationTypes.dispose();
    const config = getConfig();
    this.decorationTypes = new DecorationTypes(this.extensionPath, config.showGutterIcons);
  }

  dispose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.decorationTypes.dispose();
  }
}
