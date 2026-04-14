import * as vscode from 'vscode';

export class DecorationTypes {
  /** Applied to the whole document when grift is active — keeps all lines at a consistent indent */
  readonly spacer: vscode.TextEditorDecorationType;
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  constructor(_extensionPath: string, _showGutterIcons: boolean) {
    this.spacer = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
    });

    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  dispose() {
    this.spacer.dispose();
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
  }
}
