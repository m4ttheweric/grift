import * as vscode from 'vscode';
import { DiffBaseMode } from './types';

export function getConfig() {
  const config = vscode.workspace.getConfiguration('grift');
  return {
    defaultDiffBase: config.get<DiffBaseMode>('defaultDiffBase', 'branchBase'),
    showGutterIcons: config.get<boolean>('showGutterIcons', true),
    enableOnStartup: config.get<boolean>('enableOnStartup', false),
  };
}
