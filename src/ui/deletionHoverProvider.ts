import * as vscode from 'vscode';
import { DeletedGroup, ModifiedPair } from '../types';

/**
 * A registered HoverProvider that shows deletion/modification content
 * on anchor lines, with a clickable "Open diff" command link in the popup.
 */
export class DeletionHoverProvider implements vscode.HoverProvider {
  private deletionsByFile = new Map<string, DeletedGroup[]>();
  private modificationsByFile = new Map<string, ModifiedPair[]>();

  update(fileUri: string, deletedGroups: DeletedGroup[], modifiedPairs: ModifiedPair[]) {
    this.deletionsByFile.set(fileUri, deletedGroups);
    this.modificationsByFile.set(fileUri, modifiedPairs);
  }

  clear(fileUri: string) {
    this.deletionsByFile.delete(fileUri);
    this.modificationsByFile.delete(fileUri);
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const uri = document.uri.toString();
    const line = position.line;

    const deletedGroups = this.deletionsByFile.get(uri) ?? [];
    const modifiedPairs = this.modificationsByFile.get(uri) ?? [];

    const group = deletedGroups.find(g => g.anchorLine === line);
    const pair = modifiedPairs.find(p => p.newLine === line);

    if (!group && !pair) return undefined;

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = false;

    if (group) {
      const diffLines = group.lines.map(l => `- ${l}`).join('\n');
      md.appendMarkdown(`**${group.lines.length} deleted:**\n\`\`\`diff\n${diffLines}\n\`\`\`\n\n`);
    }

    if (pair) {
      md.appendMarkdown(`**Modified** — was:\n\`\`\`diff\n- ${pair.oldContent}\n\`\`\`\n\n`);
    }

    md.appendMarkdown(`[$(diff) Open diff](command:grift.showDiff)`);

    const lineRange = document.lineAt(line).range;
    return new vscode.Hover(md, lineRange);
  }
}
