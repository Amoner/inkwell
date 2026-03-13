// Bidirectional proportional scroll sync between editor and preview
export function setupScrollSync(editorView, previewElement) {
  let syncSource = null;

  // Editor -> Preview
  const editorScroller = editorView.scrollDOM;

  editorScroller.addEventListener("scroll", () => {
    if (syncSource === "preview") return;
    syncSource = "editor";
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    if (max > 0) {
      const ratio = editorScroller.scrollTop / max;
      const previewMax = previewElement.scrollHeight - previewElement.clientHeight;
      previewElement.scrollTop = ratio * previewMax;
    }
    requestAnimationFrame(() => { syncSource = null; });
  });

  // Preview -> Editor
  previewElement.addEventListener("scroll", () => {
    if (syncSource === "editor") return;
    syncSource = "preview";
    const max = previewElement.scrollHeight - previewElement.clientHeight;
    if (max > 0) {
      const ratio = previewElement.scrollTop / max;
      const editorMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = ratio * editorMax;
    }
    requestAnimationFrame(() => { syncSource = null; });
  });
}
