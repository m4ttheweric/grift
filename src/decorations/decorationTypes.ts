import * as vscode from 'vscode';
import * as path from 'path';

export class DecorationTypes {
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;

  constructor(extensionPath: string, showGutterIcons: boolean) {
    this.added = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      ...(showGutterIcons && {
        gutterIconPath: path.join(extensionPath, 'resources', 'dark', 'gutter-added.svg'),
        gutterIconSize: 'contain',
        light: {
          gutterIconPath: path.join(extensionPath, 'resources', 'light', 'gutter-added.svg'),
        },
      }),
    });

    this.modified = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      ...(showGutterIcons && {
        gutterIconPath: path.join(extensionPath, 'resources', 'dark', 'gutter-modified.svg'),
        gutterIconSize: 'contain',
        light: {
          gutterIconPath: path.join(extensionPath, 'resources', 'light', 'gutter-modified.svg'),
        },
      }),
    });

    this.deleted = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      ...(showGutterIcons && {
        gutterIconPath: path.join(extensionPath, 'resources', 'dark', 'gutter-deleted.svg'),
        gutterIconSize: 'contain',
        light: {
          gutterIconPath: path.join(extensionPath, 'resources', 'light', 'gutter-deleted.svg'),
        },
      }),
    });
  }

  dispose() {
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
  }
}
