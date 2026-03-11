function wrapSelection(view, before, after) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const wrapped = `${before}${selected || "text"}${after}`;
  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: {
      anchor: from + before.length,
      head: from + before.length + (selected.length || 4),
    },
  });
  return true;
}

export const markdownKeymaps = [
  {
    key: "Mod-b",
    run: (view) => wrapSelection(view, "**", "**"),
  },
  {
    key: "Mod-i",
    run: (view) => wrapSelection(view, "*", "*"),
  },
  {
    key: "Mod-k",
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const link = `[${selected || "text"}](url)`;
      view.dispatch({
        changes: { from, to, insert: link },
        selection: {
          anchor: from + selected.length + 3,
          head: from + selected.length + 6,
        },
      });
      return true;
    },
  },
  {
    key: "Mod-Shift-k",
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const code = selected.includes("\n")
        ? `\`\`\`\n${selected}\n\`\`\``
        : `\`${selected || "code"}\``;
      view.dispatch({
        changes: { from, to, insert: code },
      });
      return true;
    },
  },
];
