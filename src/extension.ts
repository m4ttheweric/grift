import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { DecorationManager } from './decorations/decorationManager';
import { StatusBar } from './ui/statusBar';
import { pickDiffBase } from './ui/diffBasePicker';
import { DeletionHoverProvider } from './ui/deletionHoverProvider';
import { ChangedFilesProvider } from './ui/changedFilesProvider';
import { DiffBaseMode } from './types';
import { getConfig } from './config';

let isActive = false;
let currentMode: DiffBaseMode = 'branchBase';
let gitService: GitService;
let decorationManager: DecorationManager;
let statusBar: StatusBar;
let changedFilesProvider: ChangedFilesProvider;
let changedFilesView: vscode.TreeView<unknown>;

export async function activate(context: vscode.ExtensionContext) {
  gitService = new GitService();
  const repoRoot = await gitService.getRepoRoot();
  if (!repoRoot) return; // Not a git repo

  const config = getConfig();
  currentMode = context.workspaceState.get<DiffBaseMode>('diffBaseMode', config.defaultDiffBase);
  statusBar = new StatusBar();

  const hoverProvider = new DeletionHoverProvider();
  decorationManager = new DecorationManager(gitService, context.extensionPath, hoverProvider);

  changedFilesProvider = new ChangedFilesProvider(gitService);

  changedFilesView = vscode.window.createTreeView('grift.changedFiles', {
    treeDataProvider: changedFilesProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(changedFilesView);

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
        await refreshActiveEditor();
      } else {
        await setIndentGuidesVisible(true);
        clearAllEditors();
        statusBar.update(false);
        updateViewDescription();
      }
    })
  );

  // Select diff base command
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.selectDiffBase', async () => {
      const selected = await pickDiffBase(currentMode);
      if (selected && selected !== currentMode) {
        currentMode = selected;
        await context.workspaceState.update('diffBaseMode', currentMode);
        if (isActive) {
          await refreshActiveEditor();
        }
      }
    })
  );

  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('grift.refresh', async () => {
      if (isActive) {
        await refreshActiveEditor();
      }
    })
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

  // Active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (isActive && editor) {
        await refreshEditor(editor);
      }
    })
  );

  // File save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (!isActive) return;
      const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
      if (editor) {
        decorationManager.debounceUpdate(editor, currentMode, (stats) => {
          statusBar.update(true, stats);
        });
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

  // Watch for branch changes
  const gitHeadWatcher = vscode.workspace.createFileSystemWatcher('**/.git/HEAD');
  gitHeadWatcher.onDidChange(async () => {
    if (isActive) {
      // Small delay to let git settle
      setTimeout(() => refreshActiveEditor(), 500);
    }
  });
  context.subscriptions.push(gitHeadWatcher);

  // Register disposables
  context.subscriptions.push(statusBar, decorationManager);

  // Auto-enable on startup if configured
  if (config.enableOnStartup) {
    isActive = true;
    await setIndentGuidesVisible(false);
    await refreshActiveEditor();
  } else {
    statusBar.update(false);
  }
}

const modeLabels: Record<DiffBaseMode, string> = {
  branchBase: 'Branch Base',
  localMain: 'Local Main',
  originMain: 'Origin Main',
  originBranch: 'Origin Branch',
};

function updateViewDescription() {
  changedFilesView.description = isActive ? modeLabels[currentMode] : 'off';
}

let originalIndentGuides: unknown;
let originalBracketPairGuides: unknown;

async function setIndentGuidesVisible(visible: boolean) {
  const config = vscode.workspace.getConfiguration('editor');
  if (!visible) {
    // Save current values before hiding
    originalIndentGuides = config.get('guides.indentation');
    originalBracketPairGuides = config.get('guides.bracketPairs');
    await config.update('guides.indentation', false, vscode.ConfigurationTarget.Workspace);
    await config.update('guides.bracketPairs', false, vscode.ConfigurationTarget.Workspace);
  } else {
    // Restore saved values (undefined = remove workspace override, falls back to user/default)
    await config.update('guides.indentation', originalIndentGuides ?? undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('guides.bracketPairs', originalBracketPairGuides ?? undefined, vscode.ConfigurationTarget.Workspace);
  }
}

async function refreshActiveEditor() {
  updateViewDescription();
  await changedFilesProvider.refresh(currentMode);
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await refreshEditor(editor);
  } else {
    statusBar.update(true);
  }
}

async function refreshEditor(editor: vscode.TextEditor) {
  const stats = await decorationManager.updateDecorations(editor, currentMode);
  statusBar.update(true, stats);
}

function clearAllEditors() {
  for (const editor of vscode.window.visibleTextEditors) {
    decorationManager.clearDecorations(editor);
  }
  changedFilesProvider.clear();
}

export function deactivate() {}
