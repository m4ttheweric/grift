import { execFile } from 'child_process';
import { promisify } from 'util';
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

  async getDefaultBranch(): Promise<string> {
    // Try main, then master, then fall back to main
    for (const branch of ['main', 'master']) {
      try {
        await this.gitFromRepo(['rev-parse', '--verify', branch]);
        return branch;
      } catch {
        continue;
      }
    }
    return 'main';
  }

  async getDefaultRemoteBranch(): Promise<string> {
    for (const branch of ['origin/main', 'origin/master']) {
      try {
        await this.gitFromRepo(['rev-parse', '--verify', branch]);
        return branch;
      } catch {
        continue;
      }
    }
    return 'origin/main';
  }

  async resolveRef(mode: DiffBaseMode): Promise<string | undefined> {
    try {
      switch (mode) {
        case 'branchBase': {
          // Prefer origin/main for merge-base — local main is often stale.
          // Fall back to local main/master if no remote exists.
          const candidates = ['origin/main', 'origin/master', 'main', 'master'];
          for (const branch of candidates) {
            try {
              await this.gitFromRepo(['rev-parse', '--verify', branch]);
              const { stdout } = await this.gitFromRepo(['merge-base', 'HEAD', branch]);
              return stdout.trim();
            } catch {
              continue;
            }
          }
          return undefined;
        }

        case 'localMain': {
          const defaultBranch = await this.getDefaultBranch();
          return defaultBranch;
        }

        case 'originMain': {
          const remoteBranch = await this.getDefaultRemoteBranch();
          return remoteBranch;
        }

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
      }
    } catch {
      return undefined;
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

  async getDiffStats(ref: string): Promise<{ added: number; deleted: number }> {
    try {
      const { stdout } = await this.gitFromRepo([
        'diff',
        ref,
        '--numstat',
      ]);
      let added = 0;
      let deleted = 0;
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        const parts = line.split('\t');
        if (parts[0] === '-') continue; // binary file
        added += parseInt(parts[0], 10) || 0;
        deleted += parseInt(parts[1], 10) || 0;
      }
      return { added, deleted };
    } catch {
      return { added: 0, deleted: 0 };
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
    if (!filePath.startsWith(this.repoRoot)) return undefined;
    return filePath.substring(this.repoRoot.length + 1);
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
