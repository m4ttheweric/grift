import * as vscode from 'vscode';

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'grift.toggle';
  }

  update(active: boolean, stats?: { added: number; deleted: number; modified: number }) {
    if (!active) {
      this.item.text = '$(git-compare) Diff Off';
      this.item.tooltip = 'Click to enable inline diff view';
      this.item.show();
      return;
    }

    if (stats) {
      const parts: string[] = [];
      if (stats.added > 0) parts.push(`+${stats.added}`);
      if (stats.modified > 0) parts.push(`~${stats.modified}`);
      if (stats.deleted > 0) parts.push(`-${stats.deleted}`);
      this.item.text = `$(git-compare) ${parts.length > 0 ? parts.join(' ') : 'No changes'}`;
    } else {
      this.item.text = '$(git-compare) Diff On';
    }
    this.item.tooltip = 'Click to toggle inline diff view';
    this.item.show();
  }

  hide() {
    this.item.hide();
  }

  dispose() {
    this.item.dispose();
  }
}
