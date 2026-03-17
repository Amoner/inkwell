// Bidirectional proportional scroll sync + cursor-based snap
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

  // Editor -> Preview (proportional)
  editorScroller.addEventListener("scroll", () => {
    if (syncSource === "preview" || syncSource === "cursor" || syncSource === "restore") return;
    syncSource = "editor";
    const max = editorScroller.scrollHeight - editorScroller.clientHeight;
    if (max > 0) {
      const ratio = editorScroller.scrollTop / max;
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = ratio * previewMax;
    }
    deferSyncReset();
  });

  // Preview -> Editor (proportional)
  previewEl.addEventListener("scroll", () => {
    if (syncSource === "editor" || syncSource === "cursor" || syncSource === "restore") return;
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

// Scroll the preview so the element matching `sourceLine` is visible.
// `sourceLine` is 1-indexed (from CM6); data-source-line is 0-indexed (from markdown-it).
export function syncPreviewToLine(sourceLine) {
  if (!previewEl) return;

  const targetLine = sourceLine - 1; // convert to 0-indexed
  const elements = previewEl.querySelectorAll("[data-source-line]");
  if (elements.length === 0) return;

  // Find the element with highest data-source-line <= targetLine
  let best = null;
  for (const el of elements) {
    const line = parseInt(el.getAttribute("data-source-line"), 10);
    if (line <= targetLine) {
      best = el;
    } else {
      break; // elements are in document order (ascending line numbers)
    }
  }

  if (!best) best = elements[0];

  // Suppress proportional sync while cursor-snap scrolls
  syncSource = "cursor";

  // Scroll so the element sits ~15% from the top of the preview pane
  const paneRect = previewEl.getBoundingClientRect();
  const elRect = best.getBoundingClientRect();
  const offset = elRect.top - paneRect.top + previewEl.scrollTop;
  const targetScroll = offset - paneRect.height * 0.15;

  previewEl.scrollTo({ top: Math.max(0, targetScroll), behavior: "instant" });

  deferSyncReset();
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

// Apply a scroll ratio to the target pane(s), suppressing sync feedback.
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

  requestAnimationFrame(() => { syncSource = null; });
}

export function setupPreviewClickNav(previewElement, setCursorFn, isClickNavActive) {
  previewElement.addEventListener("click", (e) => {
    if (isClickNavActive && !isClickNavActive()) return;
    let el = e.target;
    while (el && el !== previewElement) {
      if (el.hasAttribute("data-source-line")) {
        const line = parseInt(el.getAttribute("data-source-line"), 10);

        // Flash the clicked preview element
        el.classList.remove("click-nav-highlight");
        void el.offsetWidth;
        el.classList.add("click-nav-highlight");
        const onEnd = () => {
          el.classList.remove("click-nav-highlight");
          el.removeEventListener("animationend", onEnd);
        };
        el.addEventListener("animationend", onEnd);
        setTimeout(() => el.classList.remove("click-nav-highlight"), 1300);

        setCursorFn(line + 1); // data-source-line is 0-indexed, setCursorToLine is 1-indexed
        return;
      }
      el = el.parentElement;
    }
  });
}
