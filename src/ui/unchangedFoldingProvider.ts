import * as vscode from 'vscode';
import { DiffHunk } from '../types';

const MIN_FOLD_LINES = 4;

export class UnchangedFoldingProvider implements vscode.FoldingRangeProvider {
  private _onDidChangeFoldingRanges = new vscode.EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this._onDidChangeFoldingRanges.event;

  private rangesByFile = new Map<string, vscode.FoldingRange[]>();

  update(fileUri: string, hunks: DiffHunk[], totalLines: number) {
    this.rangesByFile.set(fileUri, computeUnchangedRanges(hunks, totalLines));
    this._onDidChangeFoldingRanges.fire();
  }

  clear(fileUri: string) {
    this.rangesByFile.delete(fileUri);
    this._onDidChangeFoldingRanges.fire();
  }

  clearAll() {
    this.rangesByFile.clear();
    this._onDidChangeFoldingRanges.fire();
  }

  /** Mid-line of each unchanged range — used to target editor.fold */
  getMidLines(fileUri: string): number[] {
    return (this.rangesByFile.get(fileUri) ?? []).map(
      r => Math.floor((r.start + r.end) / 2),
    );
  }

  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    return this.rangesByFile.get(document.uri.toString()) ?? [];
  }

  dispose() {
    this._onDidChangeFoldingRanges.dispose();
  }
}

function computeUnchangedRanges(hunks: DiffHunk[], totalLines: number): vscode.FoldingRange[] {
  if (hunks.length === 0 || totalLines === 0) return [];

  const ranges: vscode.FoldingRange[] = [];

  // Convert hunks to 0-indexed [start, end] spans in the new file.
  // newCount=0 means a pure deletion — it occupies no lines in the new file.
  const spans = hunks.map(h => ({
    start: h.newStart - 1,
    end: h.newStart - 1 + Math.max(h.newCount - 1, 0),
  }));

  const add = (start: number, end: number) => {
    if (end >= start && end - start + 1 >= MIN_FOLD_LINES) {
      ranges.push(new vscode.FoldingRange(start, end, vscode.FoldingRangeKind.Region));
    }
  };

  // Region before the first hunk
  add(0, spans[0].start - 1);

  // Regions between consecutive hunks
  for (let i = 0; i < spans.length - 1; i++) {
    add(spans[i].end + 1, spans[i + 1].start - 1);
  }

  // Region after the last hunk
  add(spans[spans.length - 1].end + 1, totalLines - 1);

  return ranges;
}
