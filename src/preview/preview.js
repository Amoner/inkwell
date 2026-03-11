import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

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

export function initPreview(element) {
  previewElement = element;
}

export function renderPreview(content) {
  if (!previewElement) return;
  const html = md.render(content);
  previewElement.innerHTML = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["disabled", "checked"],
    ADD_TAGS: ["input"],
  });
}
