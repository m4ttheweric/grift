import * as vscode from 'vscode';

export interface RemovalThreadInput {
  anchorLine: number;
  lines: string[];
  label: string;
}

/**
 * Renders deleted code blocks as collapsible inline comment threads.
 * VS Code's decoration API can't grow line height, but comment threads can —
 * the editor reserves real vertical space for them, so subsequent code stays
 * visible below the deletion. Trade: each thread carries built-in comment
 * chrome (header bar with author/label) that we can't suppress.
 */
export class DeletionCommentsProvider {
  private controller: vscode.CommentController;
  private threadsByFile = new Map<string, vscode.CommentThread[]>();

  constructor() {
    this.controller = vscode.comments.createCommentController(
      'grift.deletions',
      'Grift Removed Lines',
    );
  }

  update(uri: vscode.Uri, groups: RemovalThreadInput[], languageId: string) {
    const key = uri.toString();
    this.clear(key);
    if (groups.length === 0) return;

    const threads: vscode.CommentThread[] = [];
    for (const group of groups) {
      const range = new vscode.Range(group.anchorLine, 0, group.anchorLine, 0);
      const body = new vscode.MarkdownString();
      body.supportHtml = false;
      body.appendCodeblock(group.lines.join('\n'), languageId);

      const comment: vscode.Comment = {
        author: { name: group.label },
        body,
        mode: vscode.CommentMode.Preview,
      };

      const thread = this.controller.createCommentThread(uri, range, [comment]);
      thread.canReply = false;
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      thread.label = group.label;
      thread.contextValue = 'griftRemoval';
      threads.push(thread);
    }
    this.threadsByFile.set(key, threads);
  }

  clear(uriString: string) {
    const threads = this.threadsByFile.get(uriString);
    if (!threads) return;
    for (const t of threads) t.dispose();
    this.threadsByFile.delete(uriString);
  }

  clearAll() {
    for (const threads of this.threadsByFile.values()) {
      for (const t of threads) t.dispose();
    }
    this.threadsByFile.clear();
  }

  dispose() {
    this.clearAll();
    this.controller.dispose();
  }
}
