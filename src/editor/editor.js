import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { inkwellLight } from "./theme.js";
import { markdownKeymaps } from "./keymaps.js";
import { state } from "../state/app-state.js";

let view = null;
let changeCallbacks = [];
let cursorLineCallbacks = [];
let lastCursorLine = 1;
const themeCompartment = new Compartment();

export function createEditor(parent) {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    dropCursor(),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    history(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab, ...markdownKeymaps]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        changeCallbacks.forEach((cb) => cb(content));
      }
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos).number;
        if (line !== lastCursorLine) {
          lastCursorLine = line;
          cursorLineCallbacks.forEach((cb) => cb(line));
        }
      }
    }),
    EditorView.lineWrapping,
    themeCompartment.of(getThemeExtension()),
  ];

  view = new EditorView({
    state: EditorState.create({
      doc: "",
      extensions,
    }),
    parent,
  });

  state.on("theme", () => {
    if (view) {
      view.dispatch({
        effects: themeCompartment.reconfigure(getThemeExtension()),
      });
    }
  });

  return view;
}

function getThemeExtension() {
  let theme = state.theme;
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme === "dark" ? oneDark : inkwellLight;
}

export function getContent() {
  if (!view) return "";
  return view.state.doc.toString();
}

export function setContent(text) {
  if (!view) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

export function onContentChange(callback) {
  changeCallbacks.push(callback);
}

export function getCursorPosition() {
  if (!view) return { line: 1, col: 1 };
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return { line: line.number, col: pos - line.from + 1 };
}

export function onCursorLineChange(callback) {
  cursorLineCallbacks.push(callback);
}

export function getEditorView() {
  return view;
}
