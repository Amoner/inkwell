import { state } from "../state/app-state.js";
import { savePaneSwap } from "../state/settings.js";

// Draggable split pane divider
export function setupDivider() {
  const app = document.getElementById("app");
  const divider = document.getElementById("divider");
  const swapButton = document.getElementById("btn-swap-panes");
  const editorPane = document.getElementById("editor-pane");
  const previewPane = document.getElementById("preview-pane");
  const mainContent = document.getElementById("main-content");

  let isDragging = false;

  app.classList.toggle("panes-swapped", state.panesSwapped);

  swapButton.addEventListener("click", togglePaneSwap);
  swapButton.addEventListener("mousedown", (e) => e.stopPropagation());
  swapButton.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });

  divider.addEventListener("mousedown", startDrag);
  divider.addEventListener("touchstart", startDrag, { passive: false });

  function togglePaneSwap() {
    const swapped = !state.panesSwapped;
    app.classList.toggle("panes-swapped", swapped);
    state.set("panesSwapped", swapped);
    savePaneSwap(swapped);
  }

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    divider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchmove", onDrag, { passive: false });
    document.addEventListener("touchend", stopDrag);
  }

  let rafId = null;

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const rect = mainContent.getBoundingClientRect();
      const offset = clientX - rect.left;
      const total = rect.width;

      // Clamp between 20% and 80%
      const ratio = Math.max(0.2, Math.min(0.8, offset / total));
      const swapped = state.panesSwapped;

      editorPane.style.flex = "none";
      previewPane.style.flex = "none";
      if (swapped) {
        previewPane.style.width = `${ratio * 100}%`;
        editorPane.style.width = `${(1 - ratio) * 100}%`;
      } else {
        editorPane.style.width = `${ratio * 100}%`;
        previewPane.style.width = `${(1 - ratio) * 100}%`;
      }
    });
  }

  function stopDrag() {
    isDragging = false;
    divider.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
    document.removeEventListener("touchmove", onDrag);
    document.removeEventListener("touchend", stopDrag);
  }
}

// Reset to 50/50 split
export function resetDivider() {
  const editorPane = document.getElementById("editor-pane");
  const previewPane = document.getElementById("preview-pane");
  editorPane.style.flex = "1";
  editorPane.style.width = "";
  previewPane.style.flex = "1";
  previewPane.style.width = "";
}
