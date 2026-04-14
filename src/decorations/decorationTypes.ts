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

    // Committed — vivid colors, bold 4px border
    const addedVivid = new vscode.ThemeColor('gitDecoration.addedResourceForeground');
    const modifiedVivid = new vscode.ThemeColor('gitDecoration.modifiedResourceForeground');
    const deletedVivid = new vscode.ThemeColor('gitDecoration.deletedResourceForeground');

    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: addedVivid,
      overviewRulerColor: addedVivid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: modifiedVivid,
      overviewRulerColor: modifiedVivid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: deletedVivid,
      overviewRulerColor: deletedVivid,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Uncommitted overlay — dimmer gutter colors, subtle background, thin 2px border
    const addedDim = new vscode.ThemeColor('editorGutter.addedBackground');
    const modifiedDim = new vscode.ThemeColor('editorGutter.modifiedBackground');
    const deletedDim = new vscode.ThemeColor('editorGutter.deletedBackground');

    this.addedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: addedDim,
      overviewRulerColor: addedDim,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.modifiedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.changedLineBackground'),
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: modifiedDim,
      overviewRulerColor: modifiedDim,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    this.deletedUncommitted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: deletedDim,
      overviewRulerColor: deletedDim,
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
