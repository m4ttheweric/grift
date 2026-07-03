import * as vscode from 'vscode';
import { DiffBaseMode } from '../types';
import { GitService } from '../git/gitService';

interface DiffBaseOption {
  label: string;
  description: string;
  mode: DiffBaseMode;
}

const OPTIONS: DiffBaseOption[] = [
  {
    label: 'Branch base',
    description: 'Committed changes since branch diverged from main/master',
    mode: 'branchBase',
  },
  {
    label: 'Local main/master',
    description: 'Diff against local main/master tip',
    mode: 'localMain',
  },
  {
    label: 'Origin main/master',
    description: 'Diff against remote main/master tip',
    mode: 'originMain',
  },
  {
    label: 'Origin current branch',
    description: 'Unpushed commits vs remote tracking branch',
    mode: 'originBranch',
  },
  {
    label: 'Branch…',
    description: 'Diff against a specific branch',
    mode: 'branch',
  },
];

export interface DiffBaseSelection {
  mode: DiffBaseMode;
  branch?: string;
}

export async function pickDiffBase(
  currentMode: DiffBaseMode,
  gitService: GitService,
  currentBranch?: string,
): Promise<DiffBaseSelection | undefined> {
  // showQuickPick ignores `picked` unless canPickMany is set, so mark the
  // current mode in the description instead.
  const items = OPTIONS.map(opt => ({
    ...opt,
    description: opt.mode === currentMode ? `${opt.description} (current)` : opt.description,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select diff base to compare against',
    title: 'Git Diff Inline: Select Diff Base',
  });

  if (!selected) return undefined;

  if (selected.mode === 'branch') {
    const branch = await pickBranch(gitService, currentBranch);
    if (!branch) return undefined;
    return { mode: 'branch', branch };
  }

  return { mode: selected.mode };
}

async function pickBranch(gitService: GitService, currentBranch?: string): Promise<string | undefined> {
  const branches = await gitService.getBranches();
  const currentHead = await gitService.getCurrentBranch();

  const items = branches
    .filter(b => b !== currentHead)
    .map(b => ({
      label: b,
      description: b === currentBranch ? '(current)' : undefined,
    }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select branch to diff against',
    title: 'Git Diff Inline: Select Branch',
  });

  return selected?.label;
}
