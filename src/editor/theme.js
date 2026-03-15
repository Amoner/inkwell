import { EditorView } from "@codemirror/view";

export const inkwellLight = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-editor)",
      color: "var(--text-primary)",
      fontSize: "var(--font-size-editor)",
      fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
      caretColor: "var(--accent)",
      fontFamily: "var(--font-mono)",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--selection-bg)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--active-line-bg)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-gutter)",
      color: "var(--text-muted)",
      border: "none",
      fontFamily: "var(--font-mono)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--active-line-bg)",
      color: "var(--text-primary)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
    },
  },
  { dark: false }
);
