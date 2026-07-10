# Grift

Show git diff decorations inline in the editor, like a GitHub or GitLab merge request view. Grift marks added, modified, and deleted lines right where you're editing, so you can review your own changes without opening a separate diff tab or dropping to the terminal.

Works in VS Code, Cursor, and Antigravity.

## What it does

Grift compares your working tree against a base ref and decorates the active editor:

- added lines get a colored left border
- modified lines get a left border in a second color
- deleted lines show as a `-N` annotation, or as a collapsible comment thread with the removed code
- hovering a changed line previews the change and links to the full side-by-side diff
- the overview ruler (the scrollbar lane) gets matching markers so changes are visible at a glance
- a "Grift" view in the Source Control sidebar lists every changed file with its +/- counts, as a GitLab-style directory tree or a flat list (toggle in the view's title bar)

It tracks two layers at once, in different shades so you can tell them apart: committed changes since your branch diverged, and uncommitted working-tree changes.

## Install

Grift isn't on a marketplace. Build the `.vsix` and install it:

```bash
npm install
npm run package        # produces grift-0.1.0.vsix
```

Then install the vsix into your editor:

```bash
code --install-extension grift-0.1.0.vsix       # VS Code
cursor --install-extension grift-0.1.0.vsix     # Cursor
```

Or run `npm run install-local`, which packages and installs into Cursor and Antigravity in one step. Needs an editor on VS Code engine 1.85 or newer.

## Usage

Toggle the diff view with `Cmd+Shift+D` (`Ctrl+Shift+D` on Windows/Linux), or run "Grift: Toggle Diff View" from the command palette. Decorations appear on the active file and the sidebar fills with changed files. Toggle again to turn it off. Pick what you're comparing against with "Grift: Select Diff Base".

## Commands

| Command | What it does |
| --- | --- |
| `Grift: Toggle Diff View` | turn inline decorations on or off |
| `Grift: Select Diff Base` | pick the ref to compare against |
| `Grift: Refresh` | re-parse diffs for the sidebar and active editor |
| `Grift: Open Side-by-Side Diff` | open the built-in diff for the current file |
| `Grift: Toggle Inline Removal Diff` | switch deleted lines between `-N` annotation and comment-thread rendering |
| `Grift: Toggle Uncommitted Overlay` | show or hide the working-tree-vs-HEAD layer |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `grift.defaultDiffBase` | `branchBase` | what to diff against: `branchBase` (commits since you branched off main), `localMain`, `originMain`, `originBranch` (unpushed commits), or `branch` (a specific branch) |
| `grift.enableOnStartup` | `false` | turn the diff view on automatically when a file opens |
| `grift.theme` | `default` | color palette: `default`, `jewel`, `ocean`, `synthwave`, `sunset`, or `mono` |
| `grift.showUncommittedOverlayByDefault` | `true` | start with the uncommitted overlay enabled |

## How it works

Grift runs `git diff <base>..HEAD` per file and parses the unified diff into added, deleted, and modified regions. It pairs nearby deletions and additions by Levenshtein similarity to detect modifications rather than treating them as unrelated add/remove pairs.

Because unsaved edits shift line numbers, it also diffs the working tree against HEAD and builds a translation map, so decorations stay on the right lines while you type. Deletions can't be shown by decorations alone (the editor can't grow a line's height), so longer removed blocks render as collapsible comment threads. Side-by-side diffs are served through a custom `griftBase://` URI, so no temp files get written.

## Develop

```bash
npm run build          # bundle with esbuild
npm run watch          # rebuild on change
npm run package        # build the vsix
```
