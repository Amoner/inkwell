// Bidirectional proportional scroll sync between editor and preview
export function setupScrollSync(editorView, previewElement) {
  let syncing = false;

  // Editor -> Preview
  const editorScroller = editorView.scrollDOM;

  editorScroller.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    if (max > 0) {
      const ratio = editorScroller.scrollTop / max;
      const previewMax = previewElement.scrollHeight - previewElement.clientHeight;
      previewElement.scrollTop = ratio * previewMax;
    }
    requestAnimationFrame(() => { syncing = false; });
  });

  // Preview -> Editor
  previewElement.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    const max = previewElement.scrollHeight - previewElement.clientHeight;
    if (max > 0) {
      const ratio = previewElement.scrollTop / max;
      const editorMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = ratio * editorMax;
    }
    requestAnimationFrame(() => { syncing = false; });
  });
}
