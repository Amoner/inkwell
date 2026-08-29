import { convertFileSrc } from "@tauri-apps/api/core";

// Image sources are rewritten *after* DOMPurify has run, because DOMPurify's
// default URI filter strips `asset:` URLs. That means this module — not the
// sanitizer — is what keeps unsafe schemes out of the final `src`, so anything
// it does not explicitly recognise is refused.

const WINDOWS_DRIVE = /^[a-zA-Z]:[\\/]/;
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PASSTHROUGH_SCHEME = /^(?:https?:\/\/|data:)/i;

/**
 * Directory portion of a file path, or null when there isn't one.
 * Handles both separators so a Windows path survives.
 */
export function dirName(filePath) {
  if (!filePath) return null;
  const idx = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (idx < 0) return null;
  if (idx === 0) return filePath.slice(0, 1);
  return filePath.slice(0, idx);
}

function joinPath(dir, relative) {
  const sep = dir.includes("\\") ? "\\" : "/";
  const base = /[/\\]$/.test(dir) ? dir.slice(0, -1) : dir;
  const rel = relative.replace(/^\.\//, "").replace(/\//g, sep);
  return `${base}${sep}${rel}`;
}

function fileUrlToPath(url) {
  try {
    const { pathname, hostname } = new URL(url);
    const decoded = decodeURIComponent(pathname);
    // file://server/share/x  → UNC path
    if (hostname) return `\\\\${hostname}${decoded.replace(/\//g, "\\")}`;
    // file:///C:/x → C:/x
    return WINDOWS_DRIVE.test(decoded.slice(1)) ? decoded.slice(1) : decoded;
  } catch {
    return null;
  }
}

function toAssetUrl(path) {
  try {
    return { url: convertFileSrc(path) };
  } catch {
    // Not running inside the Tauri webview (e.g. a plain `vite preview`).
    return { reason: "unsupported" };
  }
}

/**
 * Turns a markdown image destination into something the webview can load.
 *
 * @param {string} rawSrc  destination exactly as markdown-it emitted it
 * @param {string|null} docDir  directory of the open document, if it has one
 * @returns {{url: string}|{reason: "unsaved"|"unsupported"}}
 *   `url` on success; otherwise why it could not be resolved, so the caller can
 *   say so instead of leaving a silent gap.
 */
export function resolveImageSrc(rawSrc, docDir) {
  const src = (rawSrc || "").trim();
  if (!src) return { reason: "unsupported" };

  // markdown-it percent-encodes link destinations; the file on disk has the
  // decoded name.
  let path = src;
  try {
    path = decodeURI(src);
  } catch {
    // Malformed escapes — take the destination as written.
  }

  if (PASSTHROUGH_SCHEME.test(path)) return { url: src };
  if (/^file:\/\//i.test(path)) {
    const filePath = fileUrlToPath(src);
    return filePath ? toAssetUrl(filePath) : { reason: "unsupported" };
  }

  // A Windows drive letter looks like a URL scheme; check it first.
  if (WINDOWS_DRIVE.test(path)) return toAssetUrl(path);
  if (HAS_SCHEME.test(path)) return { reason: "unsupported" };

  // Absolute POSIX path, or a UNC share.
  if (path.startsWith("/") || path.startsWith("\\\\")) return toAssetUrl(path);

  // Anything left is relative to the document, so we need to know where that is.
  if (!docDir) return { reason: "unsaved" };
  return toAssetUrl(joinPath(docDir, path));
}
