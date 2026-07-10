import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './git/gitService';
import { BaseContentProvider, BASE_SCHEME } from './git/baseContentProvider';
import { DecorationManager } from './decorations/decorationManager';
import { StatusBar } from './ui/statusBar';
import { pickDiffBase } from './ui/diffBasePicker';
import { DeletionHoverProvider } from './ui/deletionHoverProvider';
import { DeletionCommentsProvider } from './ui/deletionCommentsProvider';
import { ChangedFilesProvider } from './ui/changedFilesProvider';
import { DiffBaseMode, FileViewMode } from './types';
import { getConfig } from './config';

let isActive = false;
let currentMode: DiffBaseMode = 'branchBase';
let fileViewMode: FileViewMode = 'tree';
let selectedBranch: string | undefined;
let extContext: vscode.ExtensionContext;
let gitService: GitService;
let decorationManager: DecorationManager;
let statusBar: StatusBar;
let changedFilesProvider: ChangedFilesProvider;
let changedFilesView: vscode.TreeView<unknown>;

export async function activate(context: vscode.ExtensionContext) {
  extContext = context;
  gitService = new GitService();
  const repoRoot = await gitService.getRepoRoot();
  if (!repoRoot) return; // Not a git repo

  const config = getConfig();
  currentMode = context.workspaceState.get<DiffBaseMode>('diffBaseMode', config.defaultDiffBase);
  selectedBranch = context.workspaceState.get<string>('diffBaseBranch');
  statusBar = new StatusBar();

  const hoverProvider = new DeletionHoverProvider();
  const commentsProvider = new DeletionCommentsProvider();
  decorationManager = new DecorationManager(gitService, hoverProvider, commentsProvider);
  context.subscriptions.push({ dispose: () => commentsProvider.dispose() });

  changedFilesProvider = new ChangedFilesProvider(gitService);
  fileViewMode = context.workspaceState.get<FileViewMode>('fileViewMode', 'tree');
  changedFilesProvider.viewMode = fileViewMode;
  await vscode.commands.executeCommand('setContext', 'grift.fileViewMode', fileViewMode);

  changedFilesView = vscode.window.createTreeView('grift.changedFiles', {
    treeDataProvider: changedFilesProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(changedFilesView);

  // Register the content provider for base file versions
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(BASE_SCHEME, new BaseContentProvider(gitService)),
  );

  // Register hover provider — filters internally to only deletion/modification lines
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ pattern: '**/*' }, hoverProvider),
  );

  // Toggle command
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.toggle', async () => {
      isActive = !isActive;
      if (isActive) {
        await setIndentGuidesVisible(false);
        updateViewDescription();
        await refreshActiveEditor();
      } else {
        await setIndentGuidesVisible(true);
        clearAllEditors();
        // Hover/comment state also exists for files that are no longer
        // visible... clear it all or stale popups outlive the toggle.
        hoverProvider.clearAll();
        commentsProvider.clearAll();
        statusBar.update(false);
        updateViewDescription();
      }
    })
  );

  // Select diff base command
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.selectDiffBase', async () => {
      const selection = await pickDiffBase(currentMode, gitService, selectedBranch);
      if (!selection) return;
      const changed = selection.mode !== currentMode || selection.branch !== selectedBranch;
      if (changed) {
        currentMode = selection.mode;
        selectedBranch = selection.branch;
        await context.workspaceState.update('diffBaseMode', currentMode);
        await context.workspaceState.update('diffBaseBranch', selectedBranch);
        await refreshAll();
      }
    })
  );

  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.refresh', refreshAll)
  );

  // Show full removal diff — opens VS Code's built-in side-by-side diff editor
  // for the current (or passed-in) file vs. the resolved diff base ref.
  // Accepts an optional URI argument so it works from inlay/hover command links
  // even when activeTextEditor isn't the file the user is hovering over.
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.showDiff', async (fileUri?: vscode.Uri | string | vscode.TreeItem) => {
      let uri: vscode.Uri | undefined;
      if (fileUri instanceof vscode.Uri) {
        uri = fileUri;
      } else if (typeof fileUri === 'string') {
        uri = vscode.Uri.parse(fileUri);
      } else if (fileUri && 'resourceUri' in fileUri) {
        uri = (fileUri as vscode.TreeItem).resourceUri;
      } else {
        uri = vscode.window.activeTextEditor?.document.uri;
      }
      if (!uri) {
        vscode.window.showWarningMessage('Grift: No active file to diff');
        return;
      }
      const relativePath = gitService.getRelativePath(uri.fsPath);
      if (!relativePath) {
        vscode.window.showWarningMessage('Grift: File is not inside the repo');
        return;
      }
      const ref = await gitService.resolveRef(currentMode, selectedBranch);
      if (!ref) {
        vscode.window.showWarningMessage('Grift: Could not resolve diff base ref');
        return;
      }
      const baseUri = BaseContentProvider.buildUri(relativePath, ref);
      const title = `${relativePath} (${getModeLabel(currentMode)} ↔ working tree)`;
      await vscode.commands.executeCommand('vscode.diff', baseUri, uri, title);
    }),
  );

  // Toggle inline removal diff — render deleted lines in place instead of "-N"
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.toggleInlineRemovals', async () => {
      decorationManager.showInlineRemovals = !decorationManager.showInlineRemovals;
      if (isActive) {
        await refreshActiveEditor();
      }
      vscode.window.setStatusBarMessage(
        decorationManager.showInlineRemovals
          ? 'Grift: Inline removal diff on'
          : 'Grift: Inline removal diff off',
        2000,
      );
    }),
  );

  // Toggle uncommitted overlay
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.toggleUncommitted', async () => {
      decorationManager.showUncommittedOverlay = !decorationManager.showUncommittedOverlay;
      if (isActive) {
        await refreshActiveEditor();
      }
      vscode.window.setStatusBarMessage(
        decorationManager.showUncommittedOverlay ? 'Grift: Uncommitted overlay on' : 'Grift: Uncommitted overlay off',
        2000,
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grift.viewAsTree', () => setFileViewMode('tree')),
    vscode.commands.registerCommand('grift.viewAsFlat', () => setFileViewMode('flat')),
  );

  // Active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (isActive && editor) {
        await refreshEditor(editor);
      }
    })
  );

  // File save — sidebar refreshes regardless of overlay state
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      await changedFilesProvider.refresh(currentMode, selectedBranch);
      if (!isActive) return;
      const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
      if (editor) {
        decorationManager.debounceUpdate(editor, currentMode, (stats) => {
          statusBar.update(true, stats);
        }, selectedBranch);
      }
    })
  );

  // Configuration change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('grift')) {
        decorationManager.recreateDecorationTypes();
        if (isActive) {
          await refreshActiveEditor();
        }
      }
    })
  );

  // Watch for branch changes (HEAD) and git operations (index). The 500ms
  // delay lets git finish writing before we re-read state.
  for (const pattern of ['**/.git/HEAD', '**/.git/index']) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => {
      setTimeout(refreshAll, 500);
    });
    context.subscriptions.push(watcher);
  }

  // Watch for external file changes (e.g. git operations, edits in other tools)
  const workspaceFileWatcher = vscode.workspace.createFileSystemWatcher('**/*', true, false, false);
  workspaceFileWatcher.onDidChange(async (uri) => {
    if (isInGitDir(uri)) return;
    await changedFilesProvider.refresh(currentMode, selectedBranch);
    if (!isActive) return;
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === uri.fsPath);
    if (editor) {
      decorationManager.debounceUpdate(editor, currentMode, (stats) => {
        statusBar.update(true, stats);
      }, selectedBranch);
    }
  });
  workspaceFileWatcher.onDidDelete(async (uri) => {
    if (isInGitDir(uri)) return;
    await changedFilesProvider.refresh(currentMode, selectedBranch);
  });
  context.subscriptions.push(workspaceFileWatcher);

  // Drop per-file hover/comment state when a document closes
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      hoverProvider.clear(doc.uri.toString());
      commentsProvider.clear(doc.uri.toString());
    })
  );

  // Register disposables
  context.subscriptions.push(statusBar, decorationManager);

  if (config.enableOnStartup) {
    isActive = true;
    await setIndentGuidesVisible(false);
  } else {
    statusBar.update(false);
  }

  // Populate the sidebar immediately so the changed-files list shows up
  // even when grift's editor overlays are off.
  await refreshAll();
}

function isInGitDir(uri: vscode.Uri): boolean {
  return uri.fsPath.split(path.sep).includes('.git');
}

function getModeLabel(mode: DiffBaseMode): string {
  switch (mode) {
    case 'branchBase': return 'Branch Base';
    case 'localMain': return 'Local Main';
    case 'originMain': return 'Origin Main';
    case 'originBranch': return 'Origin Branch';
    case 'branch': return selectedBranch ?? 'Branch';
  }
}

async function setFileViewMode(mode: FileViewMode) {
  fileViewMode = mode;
  changedFilesProvider.setViewMode(mode);
  await extContext.workspaceState.update('fileViewMode', mode);
  await vscode.commands.executeCommand('setContext', 'grift.fileViewMode', mode);
}

function updateViewDescription() {
  const label = getModeLabel(currentMode);
  changedFilesView.description = isActive ? label : `${label} (overlay off)`;
}

const GUIDE_SETTINGS = ['guides.indentation', 'guides.bracketPairs'];

async function setIndentGuidesVisible(visible: boolean) {
  const config = vscode.workspace.getConfiguration('editor');
  if (!visible) {
    // Save only the workspace-level overrides, not config.get()'s effective
    // values... writing an effective value back would freeze a user/default
    // setting into .vscode/settings.json permanently. Persisted in
    // workspaceState (guarded by the hidden flag) so a window reload while
    // hidden doesn't re-save grift's own `false` as the "original".
    if (!extContext.workspaceState.get<boolean>('guidesHidden')) {
      const overrides = GUIDE_SETTINGS.map(key => config.inspect(key)?.workspaceValue ?? null);
      await extContext.workspaceState.update('savedGuideOverrides', overrides);
      await extContext.workspaceState.update('guidesHidden', true);
    }
    for (const key of GUIDE_SETTINGS) {
      await config.update(key, false, vscode.ConfigurationTarget.Workspace);
    }
  } else {
    const overrides = extContext.workspaceState.get<unknown[]>('savedGuideOverrides') ?? [];
    for (let i = 0; i < GUIDE_SETTINGS.length; i++) {
      // null -> undefined removes the workspace override entirely
      await config.update(GUIDE_SETTINGS[i], overrides[i] ?? undefined, vscode.ConfigurationTarget.Workspace);
    }
    await extContext.workspaceState.update('guidesHidden', false);
  }
}

async function refreshActiveEditor() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await refreshEditor(editor);
  } else {
    statusBar.update(true);
  }
}

async function refreshAll() {
  await refreshSidebar();
  if (isActive) {
    await refreshActiveEditor();
  }
}

async function refreshEditor(editor: vscode.TextEditor) {
  const stats = await decorationManager.updateDecorations(editor, currentMode, selectedBranch);
  statusBar.update(true, stats);
}

function clearAllEditors() {
  // Clear inline decorations on every editor — but leave the sidebar list
  // alone. The changed-files view is independent of the toggle and stays
  // populated whether or not grift's overlays are active.
  for (const editor of vscode.window.visibleTextEditors) {
    decorationManager.clearDecorations(editor);
  }
}

async function refreshSidebar() {
  await changedFilesProvider.refresh(currentMode, selectedBranch);
  updateViewDescription();
}

export function deactivate() {}
