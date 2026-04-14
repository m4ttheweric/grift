export type DiffBaseMode = 'branchBase' | 'localMain' | 'originMain' | 'originBranch';

export interface LineChange {
  type: 'add' | 'delete' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  changes: LineChange[];
}

export interface DeletedGroup {
  /** Line number in the current file where deleted lines should be rendered (0-indexed) */
  anchorLine: number;
  /** Content of each deleted line */
  lines: string[];
}

export interface ModifiedPair {
  /** Line number in the current file (0-indexed) */
  newLine: number;
  /** What the line used to say */
  oldContent: string;
  /** What the line says now */
  newContent: string;
}

export interface FileDiff {
  hunks: DiffHunk[];
  /** Line numbers in the current file that are pure additions (0-indexed) */
  addedLines: number[];
  /** Groups of consecutive deleted lines with their anchor positions */
  deletedGroups: DeletedGroup[];
  /** Pairs of old/new lines for modifications */
  modifiedPairs: ModifiedPair[];
}
