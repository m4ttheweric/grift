import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { parseDiff } from '../git/diffParser';
import { DecorationTypes } from './decorationTypes';
import { DeletionHoverProvider } from '../ui/deletionHoverProvider';
import { UnchangedFoldingProvider } from '../ui/unchangedFoldingProvider';
import { DiffBaseMode } from '../types';
import { getConfig } from '../config';

export class DecorationManager {
  private decorationTypes: DecorationTypes;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private gitService: GitService,
    private extensionPath: string,
    private hoverProvider: DeletionHoverProvider,
    private foldingProvider?: UnchangedFoldingProvider,
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

    const rawDiff = await this.gitService.getDiffForFile(ref, relativePath);
    if (!rawDiff) {
      this.clearDecorations(editor);
      return { added: 0, deleted: 0, modified: 0 };
    }

    const diff = parseDiff(rawDiff);
    const config = getConfig();
    const lastLine = editor.document.lineCount - 1;

    // Spacer — whole document, keeps all lines at a consistent left indent
    editor.setDecorations(this.decorationTypes.spacer, [
      { range: new vscode.Range(0, 0, lastLine, 0) },
    ]);

    // Added lines
    const addedDecorations: vscode.DecorationOptions[] = diff.addedLines
      .filter(line => line <= lastLine)
      .map(line => ({
        range: new vscode.Range(line, 0, line, 0),
      }));

    // Modified lines — hover is handled by DeletionHoverProvider
    const modifiedDecorations: vscode.DecorationOptions[] = diff.modifiedPairs
      .filter(pair => pair.newLine <= lastLine)
      .map(pair => ({
        range: new vscode.Range(pair.newLine, 0, pair.newLine, 0),
      }));

    // Deleted groups — label rendered via `after` with theme red colors
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
    editor.setDecorations(this.decorationTypes.deleted, deletedDecorations);

    editor.setDecorations(this.decorationTypes.added, addedDecorations);
    editor.setDecorations(this.decorationTypes.modified, modifiedDecorations);

    // Update hover provider with deletion/modification data for this file
    this.hoverProvider.update(editor.document.uri.toString(), diff.deletedGroups, diff.modifiedPairs);

    // Update folding provider with unchanged regions
    this.foldingProvider?.update(editor.document.uri.toString(), diff.hunks, editor.document.lineCount);

    return {
      added: diff.addedLines.length,
      deleted: diff.deletedGroups.reduce((sum, g) => sum + g.lines.length, 0),
      modified: diff.modifiedPairs.length,
    };
  }

  clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationTypes.spacer, []);
    editor.setDecorations(this.decorationTypes.added, []);
    editor.setDecorations(this.decorationTypes.modified, []);
    editor.setDecorations(this.decorationTypes.deleted, []);
    this.hoverProvider.clear(editor.document.uri.toString());
    this.foldingProvider?.clear(editor.document.uri.toString());
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
    this.decorationTypes = new DecorationTypes(this.extensionPath, config.showGutterIcons, config.showBackgroundColors);
  }

  dispose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.decorationTypes.dispose();
  }
}
