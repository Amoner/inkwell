import { state } from "./app-state.js";

// Settings are persisted via Tauri's store plugin on the Rust side
// For the frontend, we use localStorage as a fast cache

export async function loadSettings() {
  try {
    const savedTheme = localStorage.getItem("inkwell-theme");
    if (savedTheme) {
      state.set("theme", savedTheme);
    }
  } catch {
    // localStorage may not be available in some contexts
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem("inkwell-theme", theme);
  } catch {
    // Silently fail
  }
}
