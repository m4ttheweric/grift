import * as vscode from 'vscode';
import { GitService } from './gitService';

export const BASE_SCHEME = 'griftBase';

/**
 * Serves file content at a given git ref.
 * URI format: griftBase:/<relative-path>?ref=<ref>
 */
export class BaseContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private gitService: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const relativePath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
    const params = new URLSearchParams(uri.query);
    const ref = params.get('ref') || 'HEAD';
    return this.gitService.getFileAtRef(ref, relativePath);
  }

  fireChange(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }

  static buildUri(relativePath: string, ref: string): vscode.Uri {
    return vscode.Uri.parse(`${BASE_SCHEME}:/${relativePath}?ref=${encodeURIComponent(ref)}`);
  }

  dispose() {
    this._onDidChange.dispose();
  }
}
