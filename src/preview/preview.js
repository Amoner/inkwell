import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { state } from "../state/app-state.js";
import { dirName, resolveImageSrc } from "./asset-src.js";
import { renderMermaidBlocks } from "./mermaid.js";

let previewElement = null;

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

// Enable task lists via simple regex transform
md.core.ruler.after("inline", "task-lists", (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "inline") continue;
    const content = tokens[i].content;
    if (/^\[[ x]\]\s/.test(content)) {
      const checked = content[1] === "x";
      tokens[i].content = content.slice(4);
      // Find parent li and add class
      if (i > 0 && tokens[i - 1].type === "paragraph_open") {
        // Look for list_item_open
        for (let j = i - 2; j >= 0; j--) {
          if (tokens[j].type === "list_item_open") {
            tokens[j].attrSet("class", "task-list-item");
            // Prepend checkbox
            tokens[i].content =
              `<input type="checkbox" disabled ${checked ? "checked" : ""} /> ` +
              tokens[i].content;
            break;
          }
        }
      }
    }
  }
});

// Inject data-source-line attributes on block-level tokens for scroll sync
const blockTokens = [
  "paragraph_open", "heading_open", "fence", "code_block",
  "blockquote_open", "bullet_list_open", "ordered_list_open",
  "table_open", "hr",
];

for (const tokenType of blockTokens) {
  const defaultRender = md.renderer.rules[tokenType] ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules[tokenType] = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    if (token.map && token.map.length) {
      token.attrSet("data-source-line", String(token.map[0]));
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

// Hold the author's path in data-src and leave src unset. Local images are
// resolved after sanitizing (see rewriteImageSources), and an unset src also
// stops the webview firing a doomed request for the unresolved path.
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = self.renderInlineAsText(
    token.children,
    options,
    env
  );
  const srcIndex = token.attrIndex("src");
  if (srcIndex >= 0) {
    token.attrs[srcIndex][0] = "data-src";
  }
  return self.renderToken(tokens, idx, options);
};

function rewriteImageSources(root) {
  const docDir = dirName(state.filePath);

  root.querySelectorAll("img[data-src]").forEach((img) => {
    const rawSrc = img.getAttribute("data-src");
    const resolved = resolveImageSrc(rawSrc, docDir);
    img.removeAttribute("data-src");

    if (resolved.url) {
      img.setAttribute("src", resolved.url);
      return;
    }

    // Say why nothing appeared rather than leaving a silent gap.
    const note = document.createElement("span");
    note.className = "missing-image";
    note.textContent =
      resolved.reason === "unsaved"
        ? `${rawSrc} — save the document to show relative images`
        : `${rawSrc} — unsupported image source`;
    img.replaceWith(note);
  });
}

export function initPreview(element) {
  previewElement = element;
}

export function renderPreview(content) {
  if (!previewElement) return;
  const html = md.render(content);
  previewElement.innerHTML = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["disabled", "checked", "data-source-line", "data-src"],
    ADD_TAGS: ["input"],
  });
  rewriteImageSources(previewElement);
  renderMermaidBlocks(previewElement);
}
