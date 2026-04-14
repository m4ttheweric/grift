import * as vscode from 'vscode';
import { DeletedGroup } from '../types';

/**
 * Provides a small clickable "⊖ N" InlayHint at the start of each deletion
 * anchor line. Clicking it runs grift.showDiff with the file URI
 * passed as an argument so it doesn't depend on activeTextEditor.
 */
export class DeletionHintsProvider implements vscode.InlayHintsProvider {
  private _onDidChangeInlayHints = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this._onDidChangeInlayHints.event;

  private deletionsByFile = new Map<string, DeletedGroup[]>();

  update(fileUri: string, groups: DeletedGroup[]) {
    this.deletionsByFile.set(fileUri, groups);
    this._onDidChangeInlayHints.fire();
  }

  clear(fileUri: string) {
    this.deletionsByFile.delete(fileUri);
    this._onDidChangeInlayHints.fire();
  }

  provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.InlayHint[] {
    const groups = this.deletionsByFile.get(document.uri.toString());
    if (!groups || groups.length === 0) return [];

    const lastLine = document.lineCount - 1;
    const hints: vscode.InlayHint[] = [];

    for (const group of groups) {
      const anchorLine = Math.min(group.anchorLine, lastLine);
      if (anchorLine < range.start.line || anchorLine > range.end.line) continue;

      const labelPart = new vscode.InlayHintLabelPart(`-${group.lines.length}`);
      // Pass the document URI as an argument so the command doesn't rely on activeTextEditor
      labelPart.command = {
        title: 'Show diff',
        command: 'grift.showDiff',
        arguments: [document.uri],
      };
      labelPart.tooltip = new vscode.MarkdownString(
        `**${group.lines.length} line(s) deleted** — click to open diff\n\`\`\`\n${group.lines.join('\n')}\n\`\`\``
      );

      const hint = new vscode.InlayHint(
        new vscode.Position(anchorLine, 0),
        [labelPart],
        vscode.InlayHintKind.Parameter,
      );
      hint.paddingRight = true;
      hints.push(hint);
    }

    return hints;
  }

  dispose() {
    this._onDidChangeInlayHints.dispose();
  }
}
