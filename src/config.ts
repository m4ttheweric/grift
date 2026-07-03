import * as vscode from 'vscode';
import { DiffBaseMode, GriftTheme } from './types';

export function getConfig() {
  const config = vscode.workspace.getConfiguration('grift');
  return {
    defaultDiffBase: config.get<DiffBaseMode>('defaultDiffBase', 'branchBase'),
    enableOnStartup: config.get<boolean>('enableOnStartup', false),
    theme: config.get<GriftTheme>('theme', 'default'),
    showUncommittedOverlayByDefault: config.get<boolean>('showUncommittedOverlayByDefault', true),
  };
}
