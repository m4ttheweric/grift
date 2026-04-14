import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../git/gitService';
import { DiffBaseMode } from '../types';

export class ChangedFilesProvider implements vscode.TreeDataProvider<FileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: { path: string; added: number; deleted: number }[] = [];
  private repoRoot: string | undefined;

  constructor(private gitService: GitService) {}

  async refresh(mode: DiffBaseMode) {
    this.repoRoot = await this.gitService.getRepoRoot();
    const ref = await this.gitService.resolveRef(mode);
    this.files = ref ? await this.gitService.getChangedFiles(ref) : [];
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.files = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: FileItem): vscode.TreeItem {
    return item;
  }

  getChildren(): FileItem[] {
    return this.files.map(f => new FileItem(f.path, f.added, f.deleted, this.repoRoot));
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    filePath: string,
    added: number,
    deleted: number,
    repoRoot: string | undefined,
  ) {
    const label = path.basename(filePath);
    const dir = path.dirname(filePath);
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = [
      dir !== '.' ? dir : '',
      added > 0 ? `+${added}` : '',
      deleted > 0 ? `-${deleted}` : '',
    ].filter(Boolean).join('  ');

    this.tooltip = filePath;
    this.resourceUri = repoRoot
      ? vscode.Uri.file(path.join(repoRoot, filePath))
      : undefined;

    // Clicking opens the file
    if (this.resourceUri) {
      this.command = {
        title: 'Open file',
        command: 'vscode.open',
        arguments: [this.resourceUri],
      };
    }

    // Use VS Code's built-in file icon
    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'griftFile';
  }
}
