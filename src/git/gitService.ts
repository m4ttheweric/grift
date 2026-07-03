import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as vscode from 'vscode';
import { DiffBaseMode } from '../types';

const execFileAsync = promisify(execFile);

export class GitService {
  private repoRoot: string | undefined;

  async getRepoRoot(): Promise<string | undefined> {
    if (this.repoRoot) return this.repoRoot;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) return undefined;

    try {
      const { stdout } = await this.git(['rev-parse', '--show-toplevel'], workspaceFolder);
      this.repoRoot = stdout.trim();
      return this.repoRoot;
    } catch {
      return undefined;
    }
  }

  async getCurrentBranch(): Promise<string | undefined> {
    try {
      const { stdout } = await this.gitFromRepo(['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  async getDefaultBranch(): Promise<string | undefined> {
    return this.firstExistingRef(['main', 'master']);
  }

  async getDefaultRemoteBranch(): Promise<string | undefined> {
    return this.firstExistingRef(['origin/main', 'origin/master']);
  }

  private async firstExistingRef(candidates: string[]): Promise<string | undefined> {
    for (const ref of candidates) {
      try {
        await this.gitFromRepo(['rev-parse', '--verify', ref]);
        return ref;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async resolveRef(mode: DiffBaseMode, branchName?: string): Promise<string | undefined> {
    try {
      switch (mode) {
        case 'branchBase': {
          // Prefer origin/main for merge-base... local main is often stale.
          // Fall back to local main/master if no remote exists or histories
          // are unrelated.
          for (const branch of ['origin/main', 'origin/master', 'main', 'master']) {
            try {
              const { stdout } = await this.gitFromRepo(['merge-base', 'HEAD', branch]);
              return stdout.trim();
            } catch {
              continue;
            }
          }
          return undefined;
        }

        case 'localMain':
          return this.getDefaultBranch();

        case 'originMain':
          return this.getDefaultRemoteBranch();

        case 'originBranch': {
          const currentBranch = await this.getCurrentBranch();
          if (!currentBranch || currentBranch === 'HEAD') return undefined;
          try {
            await this.gitFromRepo(['rev-parse', '--verify', `origin/${currentBranch}`]);
            return `origin/${currentBranch}`;
          } catch {
            return undefined;
          }
        }

        case 'branch': {
          if (!branchName) return undefined;
          try {
            await this.gitFromRepo(['rev-parse', '--verify', branchName]);
            return branchName;
          } catch {
            return undefined;
          }
        }
      }
    } catch {
      return undefined;
    }
  }

  async getBranches(): Promise<string[]> {
    try {
      const { stdout } = await this.gitFromRepo(['branch', '--format=%(refname:short)']);
      return stdout.trim().split('\n').filter(b => b.length > 0);
    } catch {
      return [];
    }
  }

  async getDiffForFile(ref: string, relativePath: string, uncommitted = false): Promise<string> {
    try {
      // Uncommitted: diff working tree against HEAD (ref is 'HEAD').
      // Committed: use ref..HEAD to exclude working tree changes.
      const rangeArg = uncommitted ? ref : `${ref}..HEAD`;
      const { stdout } = await this.gitFromRepo([
        'diff',
        rangeArg,
        '--unified=3',
        '--',
        relativePath,
      ]);
      return stdout;
    } catch {
      return '';
    }
  }

  async getChangedFiles(ref: string): Promise<{ path: string; added: number; deleted: number }[]> {
    try {
      const { stdout } = await this.gitFromRepo(['diff', `${ref}..HEAD`, '--numstat']);
      return stdout.trim().split('\n').flatMap(line => {
        if (!line) return [];
        const parts = line.split('\t');
        if (parts[0] === '-') return []; // binary file
        return [{
          path: parts[2],
          added: parseInt(parts[0], 10) || 0,
          deleted: parseInt(parts[1], 10) || 0,
        }];
      });
    } catch {
      return [];
    }
  }

  async getFileAtRef(ref: string, relativePath: string): Promise<string> {
    try {
      const { stdout } = await this.gitFromRepo(['show', `${ref}:${relativePath}`]);
      return stdout;
    } catch {
      return '';
    }
  }

  getRelativePath(filePath: string): string | undefined {
    if (!this.repoRoot) return undefined;
    // Match on a full path segment so a sibling like /repo-backup doesn't
    // pass a bare startsWith(/repo) check.
    const prefix = this.repoRoot + path.sep;
    if (!filePath.startsWith(prefix)) return undefined;
    return filePath.substring(prefix.length);
  }

  private async git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  }

  private async gitFromRepo(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const root = await this.getRepoRoot();
    if (!root) throw new Error('Not a git repository');
    return this.git(args, root);
  }
}
