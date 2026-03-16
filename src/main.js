import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { createEditor, getContent, setContent, onContentChange, getCursorPosition, getEditorView } from "./editor/editor.js";
import { initPreview, renderPreview } from "./preview/preview.js";
import { setupScrollSync, getScrollRatio, applyScrollRatio } from "./preview/scroll-sync.js";
import { setupDivider, resetDivider } from "./ui/divider.js";
import { state } from "./state/app-state.js";
import { loadSettings, saveTheme } from "./state/settings.js";
import { debounce } from "./utils/debounce.js";

let editorView;
let isExternalChange = false;

async function init() {
  await loadSettings();
  applyTheme(state.theme);

  editorView = createEditor(document.getElementById("editor-pane"));
  initPreview(document.getElementById("preview-content"));

  onContentChange(
    debounce((content) => {
      renderPreview(content);
      updateWordCount(content);
      if (!state.isDirty && !isExternalChange) {
        state.set("isDirty", true);
      }
      const pos = getCursorPosition();
      document.getElementById("status-cursor").textContent = `Ln ${pos.line}, Col ${pos.col}`;
    }, 150)
  );

  // Cursor position on every change (including non-debounced)
  onContentChange(() => {
    const pos = getCursorPosition();
    document.getElementById("status-cursor").textContent = `Ln ${pos.line}, Col ${pos.col}`;
  });

  setupToolbar();
  setupDragDrop();
  setupViewButtons();
  setupDivider();
  setupResponsiveLayout();
  setupFileWatcherListener();

  // Scroll sync
  const view = getEditorView();
  if (view) {
    setupScrollSync(view, document.getElementById("preview-pane"));
  }

  // Display app version in status bar
  try {
    const version = await getVersion();
    document.getElementById("status-version").textContent = `v${version}`;
  } catch {}

  // Handle macOS file-open events for when the app is already running
  // (registered early so no events are missed during the checks below)
  await listen("open-file-requested", async (event) => {
    await loadFile(event.payload);
  });

  // Check if app was launched with a file argument
  // 1. CLI argv (Linux/Windows file associations)
  // 2. macOS Apple Events buffered in AppState (RunEvent::Opened fires before webview is ready)
  const fileArg = await invoke("get_open_file_arg");
  const pendingFile = !fileArg ? await invoke("get_pending_open_file") : null;
  const openPath = fileArg || pendingFile;

  if (openPath) {
    await loadFile(openPath);
  } else {
    await showWelcome();
  }
}

// --- File operations ---

async function newFile() {
  if (state.isDirty) {
    const discard = await invoke("confirm_discard");
    if (!discard) return;
  }
  await unwatchCurrentFile();
  setContent("");
  renderPreview("");
  state.set("filePath", null);
  state.set("fileName", "Untitled");
  state.set("isDirty", false);
  if (state.viewMode === "preview") {
    setViewMode("split");
  }
  hideWelcome();
}

async function openFile() {
  if (state.isDirty) {
    const discard = await invoke("confirm_discard");
    if (!discard) return;
  }
  const path = await invoke("pick_open_file");
  if (path) {
    await loadFile(path);
  }
}

async function loadFile(path) {
  try {
    const content = await invoke("read_file", { path });
    setContent(content);
    renderPreview(content);

    const name = path.split(/[/\\]/).pop();
    state.set("filePath", path);
    state.set("fileName", name);
    state.set("isDirty", false);

    await invoke("add_recent_file", { path });
    if (state.viewMode === "preview") {
      setViewMode("split");
    }
    hideWelcome();
    updateWordCount(content);
    await watchCurrentFile(path);
  } catch (err) {
    console.error("Failed to open file:", err);
  }
}

async function saveToPath(path) {
  await unwatchCurrentFile();
  const content = getContent();
  await invoke("write_file", { path, content });

  const name = path.split(/[/\\]/).pop();
  state.set("filePath", path);
  state.set("fileName", name);
  state.set("isDirty", false);

  await invoke("add_recent_file", { path });
  await watchCurrentFile(path);
}

async function saveFile() {
  let path = state.filePath;
  if (!path) {
    path = await invoke("pick_save_file");
    if (!path) return;
  }
  try {
    await saveToPath(path);
  } catch (err) {
    console.error("Failed to save file:", err);
  }
}

async function saveFileAs() {
  const path = await invoke("pick_save_file");
  if (!path) return;
  try {
    await saveToPath(path);
  } catch (err) {
    console.error("Failed to save file:", err);
  }
}

// --- File watcher ---

async function watchCurrentFile(path) {
  try {
    await invoke("watch_file", { path });
  } catch {
    // File watching not available (mobile) — ignore
  }
}

async function unwatchCurrentFile() {
  try {
    await invoke("unwatch_file");
  } catch {
    // Ignore
  }
}

function setupFileWatcherListener() {
  listen("file-changed-externally", async () => {
    if (!state.filePath) return;
    try {
      const content = await invoke("read_file", { path: state.filePath });
      isExternalChange = true;
      setContent(content);
      renderPreview(content);
      updateWordCount(content);
      isExternalChange = false;

      const statusEl = document.getElementById("status-file-info");
      const original = statusEl.textContent;
      statusEl.textContent = "File reloaded (changed externally)";
      setTimeout(() => {
        statusEl.textContent = original;
      }, 3000);
    } catch (err) {
      console.error("Failed to reload file:", err);
    }
  });
}

// --- UI state ---

function applyTheme(theme) {
  let resolved = theme;
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", resolved);
}

function toggleTheme() {
  const current = state.theme;
  const next = current === "dark" ? "light" : current === "light" ? "dark" :
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  state.set("theme", next);
  applyTheme(next);
  saveTheme(next);
}

function setViewMode(mode) {
  // Capture scroll position from the current mode before switching
  const prevMode = state.viewMode;
  const ratio = getScrollRatio(prevMode);

  state.set("viewMode", mode);
  const main = document.getElementById("main-content");
  main.className = `view-${mode}`;

  document.querySelectorAll(".view-btn").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`btn-view-${mode}`).classList.add("active");

  if (mode === "split") {
    resetDivider();
  }

  if (mode === "preview" || mode === "split") {
    renderPreview(getContent());
  }

  // Restore scroll position in the new mode after layout settles
  requestAnimationFrame(() => {
    applyScrollRatio(ratio, mode);
  });
}

function updateWordCount(content) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  document.getElementById("status-word-count").textContent = `${words} words`;
}

// --- Responsive layout ---

function setupResponsiveLayout() {
  const mq = window.matchMedia("(max-width: 640px)");

  function handleResize(e) {
    document.body.classList.toggle("mobile", e.matches);
    if (e.matches && state.viewMode === "split") {
      setViewMode("editor");
    }
  }

  mq.addEventListener("change", handleResize);
  handleResize(mq);
}

// --- Welcome screen ---

async function showWelcome() {
  const welcome = document.getElementById("welcome-screen");
  welcome.classList.add("visible");

  try {
    const recentFiles = await invoke("get_recent_files");
    const list = document.getElementById("recent-list");
    list.innerHTML = "";
    if (recentFiles.length === 0) {
      document.getElementById("recent-files").style.display = "none";
    } else {
      document.getElementById("recent-files").style.display = "block";
      recentFiles.forEach((file) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "recent-file-btn";
        btn.textContent = file.name;
        btn.title = file.path;
        btn.addEventListener("click", () => loadFile(file.path));
        li.appendChild(btn);
        list.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Failed to load recent files:", err);
  }
}

function hideWelcome() {
  document.getElementById("welcome-screen").classList.remove("visible");
}

// --- Toolbar ---

function setupToolbar() {
  document.getElementById("btn-new").addEventListener("click", newFile);
  document.getElementById("btn-open").addEventListener("click", openFile);
  document.getElementById("btn-save").addEventListener("click", saveFile);
  document.getElementById("btn-theme").addEventListener("click", toggleTheme);
  document.getElementById("btn-close").addEventListener("click", closeApp);
  document.getElementById("welcome-new").addEventListener("click", newFile);
  document.getElementById("welcome-open").addEventListener("click", openFile);
}

async function closeApp() {
  if (state.isDirty) {
    const discard = await invoke("confirm_discard");
    if (!discard) return;
  }
  await unwatchCurrentFile();
  const appWindow = getCurrentWindow();
  await appWindow.close();
}

function setupViewButtons() {
  document.getElementById("btn-view-editor").addEventListener("click", () => setViewMode("editor"));
  document.getElementById("btn-view-split").addEventListener("click", () => setViewMode("split"));
  document.getElementById("btn-view-preview").addEventListener("click", () => setViewMode("preview"));
}

function setupDragDrop() {
  const appWindow = getCurrentWindow();
  appWindow.onDragDropEvent(async (event) => {
    if (event.payload.type === "drop") {
      const paths = event.payload.paths;
      if (paths.length > 0) {
        const mdPath = paths.find((p) => /\.(md|markdown|mdown|mkd|txt)$/i.test(p));
        if (mdPath) {
          await loadFile(mdPath);
        }
      }
    }
  });
}

// --- State listeners ---

state.on("isDirty", (dirty) => {
  const indicator = document.getElementById("dirty-indicator");
  indicator.classList.toggle("hidden", !dirty);
  const appWindow = getCurrentWindow();
  const title = dirty ? `${state.fileName} * - Inkwell` : `${state.fileName} - Inkwell`;
  appWindow.setTitle(title);
});

state.on("fileName", (name) => {
  document.getElementById("file-title").textContent = name;
  document.getElementById("status-file-info").textContent = state.filePath || "";
});

// --- Keyboard shortcuts ---
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "s" && !e.shiftKey) {
    e.preventDefault();
    saveFile();
  } else if (mod && e.key === "s" && e.shiftKey) {
    e.preventDefault();
    saveFileAs();
  } else if (mod && e.key === "o") {
    e.preventDefault();
    openFile();
  } else if (mod && e.key === "n") {
    e.preventDefault();
    newFile();
  }
});

// --- Initialize ---
init();
