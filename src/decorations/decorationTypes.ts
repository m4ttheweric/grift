import * as vscode from 'vscode';

export class DecorationTypes {
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  constructor(_extensionPath: string, _showGutterIcons: boolean) {
    // Use a left border on the text area rather than SVG gutter icons.
    // SVG gutter icons each get their own horizontal lane, so three
    // decoration types would show three offset bars side-by-side.
    // A left border is drawn in the same position for every type.
    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
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
