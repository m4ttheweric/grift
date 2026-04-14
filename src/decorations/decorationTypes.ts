import * as vscode from 'vscode';

export class DecorationTypes {
  /** Applied to the whole document when grift is active — keeps all lines at a consistent indent */
  readonly spacer: vscode.TextEditorDecorationType;
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  constructor(_extensionPath: string, _showGutterIcons: boolean, uncommitted = false) {
    this.spacer = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: { contentText: '\u00a0', margin: '0 6px 0 0' },
    });

    // Committed modes use vivid gitDecoration colors.
    // Uncommitted (branchHead) uses the dimmer editorGutter colors.
    const addedColor = uncommitted
      ? new vscode.ThemeColor('editorGutter.addedBackground')
      : new vscode.ThemeColor('gitDecoration.addedResourceForeground');
    // Modified uses a blue-toned token to stay clearly distinct from the green added.
    const modifiedColor = uncommitted
      ? new vscode.ThemeColor('editorGutter.modifiedBackground')
      : new vscode.ThemeColor('editorGutter.modifiedBackground');
    const deletedColor = uncommitted
      ? new vscode.ThemeColor('editorGutter.deletedBackground')
      : new vscode.ThemeColor('gitDecoration.deletedResourceForeground');

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
  }

  dispose() {
    this.spacer.dispose();
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
  }
}
