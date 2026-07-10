import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../git/gitService';
import { DiffBaseMode, FileViewMode } from '../types';

interface ChangedFile {
  path: string;
  added: number;
  deleted: number;
}

interface DirNode {
  name: string;
  dirs: Map<string, DirNode>;
  files: ChangedFile[];
}

export class ChangedFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: ChangedFile[] = [];
  private repoRoot: string | undefined;
  viewMode: FileViewMode = 'tree';

  constructor(private gitService: GitService) {}

  async refresh(mode: DiffBaseMode, branchName?: string) {
    this.repoRoot = await this.gitService.getRepoRoot();
    const ref = await this.gitService.resolveRef(mode, branchName);
    this.files = ref ? await this.gitService.getChangedFiles(ref) : [];
    this._onDidChangeTreeData.fire();
  }

  setViewMode(mode: FileViewMode) {
    this.viewMode = mode;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (this.viewMode === 'flat') {
      return element ? [] : this.files.map(f => new FileItem(f, this.repoRoot, true));
    }
    if (element instanceof DirItem) {
      return this.renderLevel(element.node);
    }
    return element ? [] : this.renderLevel(this.buildTree());
  }

  private buildTree(): DirNode {
    const root: DirNode = { name: '', dirs: new Map(), files: [] };
    for (const file of this.files) {
      const segments = file.path.split('/');
      let node = root;
      for (const segment of segments.slice(0, -1)) {
        let child = node.dirs.get(segment);
        if (!child) {
          child = { name: segment, dirs: new Map(), files: [] };
          node.dirs.set(segment, child);
        }
        node = child;
      }
      node.files.push(file);
    }
    return root;
  }

  private renderLevel(node: DirNode): vscode.TreeItem[] {
    const dirs = [...node.dirs.values()]
      .map(compactChain)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => new DirItem(d));
    const files = [...node.files]
      .sort((a, b) => path.basename(a.path).localeCompare(path.basename(b.path)))
      .map(f => new FileItem(f, this.repoRoot, false));
    return [...dirs, ...files];
  }
}

// GitLab-style path compaction: a chain of directories with a single child
// and no files collapses into one node labeled "a/b/c".
function compactChain(node: DirNode): DirNode {
  let current = node;
  const labels = [node.name];
  while (current.dirs.size === 1 && current.files.length === 0) {
    current = current.dirs.values().next().value!;
    labels.push(current.name);
  }
  return { name: labels.join('/'), dirs: current.dirs, files: current.files };
}

class DirItem extends vscode.TreeItem {
  constructor(readonly node: DirNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = vscode.ThemeIcon.Folder;
    this.contextValue = 'griftDir';
  }
}

class FileItem extends vscode.TreeItem {
  constructor(file: ChangedFile, repoRoot: string | undefined, showDir: boolean) {
    super(path.basename(file.path), vscode.TreeItemCollapsibleState.None);
    const dir = path.dirname(file.path);

    this.description = [
      showDir && dir !== '.' ? dir : '',
      file.added > 0 ? `+${file.added}` : '',
      file.deleted > 0 ? `-${file.deleted}` : '',
    ].filter(Boolean).join('  ');

    this.tooltip = file.path;
    this.resourceUri = repoRoot
      ? vscode.Uri.file(path.join(repoRoot, file.path))
      : undefined;

    if (this.resourceUri) {
      this.command = {
        title: 'Open file',
        command: 'vscode.open',
        arguments: [this.resourceUri],
      };
    }

    this.iconPath = vscode.ThemeIcon.File;
    this.contextValue = 'griftFile';
  }
}
