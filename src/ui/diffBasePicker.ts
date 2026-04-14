import * as vscode from 'vscode';
import { DiffBaseMode } from '../types';

interface DiffBaseOption {
  label: string;
  description: string;
  mode: DiffBaseMode;
}

const OPTIONS: DiffBaseOption[] = [
  {
    label: 'Branch base',
    description: 'Changes since branch diverged from main/master',
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
];

export async function pickDiffBase(currentMode: DiffBaseMode): Promise<DiffBaseMode | undefined> {
  const items = OPTIONS.map(opt => ({
    ...opt,
    picked: opt.mode === currentMode,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select diff base to compare against',
    title: 'Git Diff Inline: Select Diff Base',
  });

  return selected?.mode;
}
