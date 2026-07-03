import * as vscode from 'vscode';
import { GitService } from './gitService';

export const BASE_SCHEME = 'griftBase';

/**
 * Serves file content at a given git ref.
 * URI format: griftBase:/<relative-path>?ref=<ref>
 */
export class BaseContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private gitService: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const relativePath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
    const params = new URLSearchParams(uri.query);
    const ref = params.get('ref') || 'HEAD';
    return this.gitService.getFileAtRef(ref, relativePath);
  }

  static buildUri(relativePath: string, ref: string): vscode.Uri {
    // Uri.from escapes each component; Uri.parse would misread paths
    // containing '?' or '#'.
    return vscode.Uri.from({
      scheme: BASE_SCHEME,
      path: `/${relativePath}`,
      query: `ref=${encodeURIComponent(ref)}`,
    });
  }
}
