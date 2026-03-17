import { state } from "../state/app-state.js";

let activeEdit = null;

/**
 * Sets up inline editing for preview-only mode.
 * Clicking a block element with data-source-line opens a textarea to edit raw markdown.
 */
export function setupInlineEdit(previewElement, getContentFn, replaceLinesFn, renderPreviewFn) {
  previewElement.addEventListener("click", (e) => {
    if (state.viewMode !== "preview") return;

    // Walk up to find the element with data-source-line
    let el = e.target;
    while (el && el !== previewElement) {
      if (el.hasAttribute("data-source-line")) break;
      el = el.parentElement;
    }
    if (!el || el === previewElement) return;

    // If clicking the same block that's already being edited, do nothing
    if (activeEdit && activeEdit.element === el) return;

    // If a different block is being edited, commit it first
    if (activeEdit) {
      commitEdit(getContentFn, replaceLinesFn, renderPreviewFn);
      // After commit, the preview re-renders so the clicked element is gone.
      // The user will need to click again.
      return;
    }

    openEdit(el, previewElement, getContentFn, replaceLinesFn, renderPreviewFn);
  });
}

function openEdit(el, previewElement, getContentFn, replaceLinesFn, renderPreviewFn) {
  const content = getContentFn();
  const lines = content.split("\n");

  const startLine = parseInt(el.getAttribute("data-source-line"), 10);

  // Find end line: next sibling's data-source-line - 1, or end of document
  let endLine = lines.length - 1;
  const allBlocks = previewElement.querySelectorAll("[data-source-line]");
  for (let i = 0; i < allBlocks.length; i++) {
    if (allBlocks[i] === el && i + 1 < allBlocks.length) {
      endLine = parseInt(allBlocks[i + 1].getAttribute("data-source-line"), 10) - 1;
      break;
    }
  }

  // Clamp
  const clampedStart = Math.max(0, Math.min(startLine, lines.length - 1));
  const clampedEnd = Math.max(clampedStart, Math.min(endLine, lines.length - 1));

  const sourceText = lines.slice(clampedStart, clampedEnd + 1).join("\n");

  // Hide the original element
  el.style.display = "none";

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "inline-edit-wrapper";

  // Create textarea
  const textarea = document.createElement("textarea");
  textarea.className = "inline-edit-textarea";
  textarea.value = sourceText;
  textarea.spellcheck = false;

  // Create hint bar
  const isMac = navigator.platform.includes("Mac") || navigator.userAgent.includes("Mac");
  const modKey = isMac ? "Cmd" : "Ctrl";
  const hint = document.createElement("div");
  hint.className = "inline-edit-hint";
  hint.textContent = `${modKey}+Enter to save \u00b7 Escape to cancel`;

  wrapper.appendChild(textarea);
  wrapper.appendChild(hint);

  // Insert after the hidden element
  el.parentNode.insertBefore(wrapper, el.nextSibling);

  // Auto-resize
  function autoResize() {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
  autoResize();
  textarea.addEventListener("input", autoResize);

  // Focus
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  // Track active edit
  activeEdit = {
    element: el,
    wrapper,
    textarea,
    startLine: clampedStart,
    endLine: clampedEnd,
    originalText: sourceText,
    blurTimer: null,
  };

  // Keyboard handlers
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelCurrentEdit();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      commitEdit(getContentFn, replaceLinesFn, renderPreviewFn);
      return;
    }
    // Tab inserts literal tab
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      autoResize();
    }
  });

  // Blur → auto-save after delay (to avoid race with clicks)
  textarea.addEventListener("blur", () => {
    if (!activeEdit) return;
    activeEdit.blurTimer = setTimeout(() => {
      if (activeEdit && activeEdit.textarea === textarea) {
        commitEdit(getContentFn, replaceLinesFn, renderPreviewFn);
      }
    }, 150);
  });

  // Cancel blur timer if focus returns (e.g. clicking hint text)
  textarea.addEventListener("focus", () => {
    if (activeEdit && activeEdit.blurTimer) {
      clearTimeout(activeEdit.blurTimer);
      activeEdit.blurTimer = null;
    }
  });
}

function commitEdit(getContentFn, replaceLinesFn, renderPreviewFn) {
  if (!activeEdit) return;

  const newText = activeEdit.textarea.value;
  const { startLine, endLine, originalText } = activeEdit;

  // Clean up DOM
  cleanupActiveEdit();

  // Only dispatch changes if text actually changed
  if (newText !== originalText) {
    replaceLinesFn(startLine, endLine, newText);
  }

  // Always re-render to restore the preview element
  renderPreviewFn(getContentFn());
}

function cancelCurrentEdit() {
  if (!activeEdit) return;
  cleanupActiveEdit();
}

function cleanupActiveEdit() {
  if (!activeEdit) return;
  const { element, wrapper, blurTimer } = activeEdit;
  if (blurTimer) clearTimeout(blurTimer);
  // Restore hidden element
  element.style.display = "";
  // Remove wrapper
  if (wrapper.parentNode) {
    wrapper.parentNode.removeChild(wrapper);
  }
  activeEdit = null;
}

/**
 * Cancel any active inline edit. Called externally before preview innerHTML
 * is replaced (e.g. by file watcher).
 */
export function cancelActiveEdit() {
  if (!activeEdit) return;
  // The DOM may already be destroyed by innerHTML replacement,
  // so just reset state without DOM cleanup
  if (activeEdit.blurTimer) clearTimeout(activeEdit.blurTimer);
  activeEdit = null;
}
