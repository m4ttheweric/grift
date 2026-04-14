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

    // Committed: solid 4px border (vivid — these changes are locked in)
    // Uncommitted: dashed 2px border (same colors, visually lighter — still in progress)
    const borderStyle = uncommitted ? 'dashed' : 'solid';
    const borderWidth = uncommitted ? '0 0 0 2px' : '0 0 0 4px';

    const addedColor = new vscode.ThemeColor('gitDecoration.addedResourceForeground');
    const modifiedColor = new vscode.ThemeColor('editorGutter.modifiedBackground');
    const deletedColor = new vscode.ThemeColor('gitDecoration.deletedResourceForeground');

    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth,
      borderStyle,
      borderColor: addedColor,
      overviewRulerColor: addedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth,
      borderStyle,
      borderColor: modifiedColor,
      overviewRulerColor: modifiedColor,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth,
      borderStyle,
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
