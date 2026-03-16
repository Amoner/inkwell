// Bidirectional proportional scroll sync between editor and preview
let editorScroller = null;
let previewEl = null;
let syncSource = null;
let syncResetTimer = null;

function deferSyncReset() {
  clearTimeout(syncResetTimer);
  syncResetTimer = setTimeout(() => { syncSource = null; }, 200);
}

export function setupScrollSync(editorView, previewElement) {
  editorScroller = editorView.scrollDOM;
  previewEl = previewElement;

  // Editor -> Preview
  editorScroller.addEventListener("scroll", () => {
    if (syncSource === "preview" || syncSource === "restore") return;
    syncSource = "editor";
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    if (max > 0) {
      const ratio = editorScroller.scrollTop / max;
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = ratio * previewMax;
    }
    deferSyncReset();
  });

  // Preview -> Editor
  previewEl.addEventListener("scroll", () => {
    if (syncSource === "editor" || syncSource === "restore") return;
    syncSource = "preview";
    const max = previewEl.scrollHeight - previewEl.clientHeight;
    if (max > 0) {
      const ratio = previewEl.scrollTop / max;
      const editorMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = ratio * editorMax;
    }
    deferSyncReset();
  });
}

// Get the current scroll ratio from whichever pane is visible
export function getScrollRatio(activeMode) {
  if (activeMode === "editor" && editorScroller) {
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    return max > 0 ? editorScroller.scrollTop / max : 0;
  }
  if (activeMode === "preview" && previewEl) {
    const max = previewEl.scrollHeight - previewEl.clientHeight;
    return max > 0 ? previewEl.scrollTop / max : 0;
  }
  // Split mode — use editor as source of truth
  if (editorScroller) {
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    return max > 0 ? editorScroller.scrollTop / max : 0;
  }
  return 0;
}

// Apply a scroll ratio to the target pane(s), suppressing sync feedback
export function applyScrollRatio(ratio, targetMode) {
  syncSource = "restore";

  if ((targetMode === "editor" || targetMode === "split") && editorScroller) {
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    editorScroller.scrollTop = ratio * max;
  }
  if ((targetMode === "preview" || targetMode === "split") && previewEl) {
    const max = previewEl.scrollHeight - previewEl.clientHeight;
    previewEl.scrollTop = ratio * max;
  }

  deferSyncReset();
}
