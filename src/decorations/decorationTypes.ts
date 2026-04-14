import * as vscode from 'vscode';

export class DecorationTypes {
  /** Applied to every line when grift is active — keeps all lines at a consistent indent */
  readonly spacer: vscode.TextEditorDecorationType;

  // Committed diff — solid 4px left border
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  // Uncommitted overlay — subtle background tint + thin 2px border
  readonly addedUncommitted: vscode.TextEditorDecorationType;
  readonly modifiedUncommitted: vscode.TextEditorDecorationType;
  readonly deletedUncommitted: vscode.TextEditorDecorationType;

  constructor(_extensionPath: string, _showGutterIcons: boolean) {
    this.spacer = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
    });

    // Committed — vivid 4px border, no background fill
    const addedColor = new vscode.ThemeColor('editorGutter.addedBackground');
    const modifiedColor = new vscode.ThemeColor('editorGutter.modifiedBackground');
    const deletedColor = new vscode.ThemeColor('editorGutter.deletedBackground');

    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: addedColor,
      overviewRulerColor: addedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: modifiedColor,
      overviewRulerColor: modifiedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: deletedColor,
      overviewRulerColor: deletedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Uncommitted overlay — background fill only, no border (avoids competing with committed border)
    this.addedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      overviewRulerColor: addedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.modifiedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.changedLineBackground'),
      overviewRulerColor: modifiedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.deletedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      overviewRulerColor: deletedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  dispose() {
    this.spacer.dispose();
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
    this.addedUncommitted.dispose();
    this.modifiedUncommitted.dispose();
    this.deletedUncommitted.dispose();
  }
}
