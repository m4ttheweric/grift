import * as vscode from 'vscode';

export class DecorationTypes {
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  constructor(_extensionPath: string, _showGutterIcons: boolean) {
    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  dispose() {
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
  }
}
