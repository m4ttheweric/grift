import * as vscode from "vscode";
import { GriftTheme } from "../types";

interface ColorPair {
  dark: string;
  light: string;
}

interface ColorSet {
  committed: ColorPair;
  uncommitted: ColorPair;
}

interface ThemePalette {
  added: ColorSet;
  modified: ColorSet;
  deleted: ColorSet;
}

// Each theme picks an explicitly distinct uncommitted hue so the side border
// reads as a different category, not just a dimmer version of committed.
const THEMES: Record<GriftTheme, ThemePalette> = {
  default: {
    added: {
      committed: { dark: "#2ea043", light: "#1a7f37" },
      uncommitted: { dark: "#86efac", light: "#22c55e" }, // lighter pastel green
    },
    modified: {
      committed: { dark: "#d29922", light: "#9a6700" },
      uncommitted: { dark: "#fde68a", light: "#ca8a04" }, // pale gold
    },
    deleted: {
      committed: { dark: "#f85149", light: "#cf222e" },
      uncommitted: { dark: "#fca5a5", light: "#e11d48" }, // light rose
    },
  },
  jewel: {
    added: {
      committed: { dark: "#10a37f", light: "#0e8c6c" }, // emerald
      uncommitted: { dark: "#5eead4", light: "#0d9488" }, // teal
    },
    modified: {
      committed: { dark: "#f5a623", light: "#cc8500" }, // amber
      uncommitted: { dark: "#fde68a", light: "#a16207" }, // pale gold
    },
    deleted: {
      committed: { dark: "#c41e3a", light: "#a01528" }, // ruby
      uncommitted: { dark: "#fb7185", light: "#e11d48" }, // rose
    },
  },
  ocean: {
    added: {
      committed: { dark: "#3b9eff", light: "#0969da" }, // sky
      uncommitted: { dark: "#a78bfa", light: "#7c3aed" }, // lavender (warm-cool shift)
    },
    modified: {
      committed: { dark: "#14b8a6", light: "#0f766e" }, // teal
      uncommitted: { dark: "#fde68a", light: "#a16207" }, // pale gold (warm contrast)
    },
    deleted: {
      committed: { dark: "#6366f1", light: "#4338ca" }, // indigo
      uncommitted: { dark: "#fb7185", light: "#e11d48" }, // rose (warm contrast)
    },
  },
  synthwave: {
    added: {
      committed: { dark: "#22d3ee", light: "#0891b2" }, // cyan
      uncommitted: { dark: "#facc15", light: "#ca8a04" }, // neon yellow
    },
    modified: {
      committed: { dark: "#e879f9", light: "#a21caf" }, // magenta
      uncommitted: { dark: "#fb923c", light: "#ea580c" }, // neon orange
    },
    deleted: {
      // committed:   { dark: '#8b5cf6', light: '#6d28d9' }, // violet
      // uncommitted: { dark: '#fb7185', light: '#e11d48' }, // neon rose
      committed: { dark: "#c41e3a", light: "#a01528" }, // ruby
      uncommitted: { dark: "#fb7185", light: "#e11d48" }, // rose
    },
  },
  sunset: {
    added: {
      committed: { dark: "#fdba74", light: "#ea580c" }, // peach
      uncommitted: { dark: "#5eead4", light: "#0d9488" }, // teal (cool contrast)
    },
    modified: {
      committed: { dark: "#f472b6", light: "#be185d" }, // pink
      uncommitted: { dark: "#7dd3fc", light: "#0284c7" }, // sky (cool contrast)
    },
    deleted: {
      committed: { dark: "#a855f7", light: "#7e22ce" }, // purple
      uncommitted: { dark: "#fbbf24", light: "#b45309" }, // amber (warm contrast)
    },
  },
  mono: {
    added: {
      committed: { dark: "#cbd5e1", light: "#475569" }, // light slate
      uncommitted: { dark: "#7dd3fc", light: "#0284c7" }, // sky-blue tint
    },
    modified: {
      committed: { dark: "#94a3b8", light: "#334155" }, // mid slate
      uncommitted: { dark: "#60a5fa", light: "#2563eb" }, // saturated blue
    },
    deleted: {
      committed: { dark: "#64748b", light: "#1e293b" }, // dark slate
      uncommitted: { dark: "#1d4ed8", light: "#1e3a8a" }, // deep blue
    },
  },
};

const UNCOMMITTED_BG_ALPHA = 0.12;
const RULER_COMMITTED_ALPHA = 0.55;
const RULER_UNCOMMITTED_ALPHA = 0.32;

export class DecorationTypes {
  readonly spacer: vscode.TextEditorDecorationType;
  readonly added: vscode.TextEditorDecorationType;
  readonly modified: vscode.TextEditorDecorationType;
  readonly deleted: vscode.TextEditorDecorationType;
  readonly addedUncommitted: vscode.TextEditorDecorationType;
  readonly modifiedUncommitted: vscode.TextEditorDecorationType;
  readonly deletedUncommitted: vscode.TextEditorDecorationType;

  constructor(theme: GriftTheme) {
    const palette = THEMES[theme] ?? THEMES.default;

    this.spacer = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: { contentText: " ", margin: "0 6px 0 0" },
    });

    this.added = makeCommitted(palette.added.committed);
    this.modified = makeCommitted(palette.modified.committed);
    this.deleted = makeCommitted(palette.deleted.committed);

    this.addedUncommitted = makeUncommitted(palette.added.uncommitted);
    this.modifiedUncommitted = makeUncommitted(palette.modified.uncommitted);
    this.deletedUncommitted = makeUncommitted(palette.deleted.uncommitted);
  }

  dispose() {
    this.spacer.dispose();
    this.added.dispose();
    this.modified.dispose();
    this.deleted.dispose();
    this.addedUncommitted.dispose();
    this.modifiedUncommitted.dispose();
    this.deletedUncommitted.dispose();
  }
}

function rgbOf(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pairWithAlpha(c: ColorPair, alpha: number): ColorPair {
  return { dark: withAlpha(c.dark, alpha), light: withAlpha(c.light, alpha) };
}

function makeCommitted(border: ColorPair): vscode.TextEditorDecorationType {
  const ruler = pairWithAlpha(border, RULER_COMMITTED_ALPHA);
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: "0 0 0 4px",
    borderStyle: "solid",
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    dark: { borderColor: border.dark, overviewRulerColor: ruler.dark },
    light: { borderColor: border.light, overviewRulerColor: ruler.light },
  });
}

function makeUncommitted(border: ColorPair): vscode.TextEditorDecorationType {
  const bg = pairWithAlpha(border, UNCOMMITTED_BG_ALPHA);
  const ruler = pairWithAlpha(border, RULER_UNCOMMITTED_ALPHA);
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: "0 0 0 4px",
    borderStyle: "solid",
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    dark: {
      borderColor: border.dark,
      backgroundColor: bg.dark,
      overviewRulerColor: ruler.dark,
    },
    light: {
      borderColor: border.light,
      backgroundColor: bg.light,
      overviewRulerColor: ruler.light,
    },
  });
}
