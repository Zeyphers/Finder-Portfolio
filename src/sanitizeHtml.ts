import DOMPurify from "dompurify";

// Rich text from the process editor is rendered with dangerouslySetInnerHTML.
// It's normally authored by the admin, so the risk isn't self-XSS — it's that
// importSiteZip only validates the *shape* of a restored backup, never its
// content. Restoring a tampered zip would otherwise inject script into the live
// site (and the admin token sits in localStorage, ready to be stolen).
//
// Sanitising at render means it doesn't matter how bad markup got in: pasted,
// imported, or written straight into the blob.

// Everything Quill + blot-formatter legitimately emit, and nothing else.
const ALLOWED_TAGS = [
  "p", "br", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
  "blockquote", "pre", "code",
  "ol", "ul", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "title",
  // blot-formatter writes sizing onto the image as attributes and inline style.
  "src", "alt", "width", "height", "style",
  "class", "colspan", "rowspan",
];

// `style` has to stay allowed (blot-formatter sizes images with it), but that
// lets CSS-borne payloads through — url(javascript:…) and IE-era expression().
// Neither executes in a current browser, so this is belt-and-braces rather than
// a live hole; legitimate editor output never contains either, so dropping the
// whole attribute when one appears costs nothing.
let hookInstalled = false;
const installStyleHook = () => {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", node => {
    const el = node as Element;
    const style = el.getAttribute?.("style");
    if (style && /javascript:|expression\s*\(/i.test(style)) {
      el.removeAttribute("style");
    }
  });
};

export const sanitizeRichText = (html?: string): string => {
  if (!html) return "";
  installStyleHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:/vbscript: hrefs; data: is still fine for images.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // No <form>, no <template> escapes, no MathML/SVG payloads.
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "svg", "math"],
    FORBID_ATTR: ["srcset", "formaction", "xlink:href"],
  });
};

// Strip anything dangerous from a whole restored data.json before it is trusted.
export const sanitizeProjectsHtml = <T extends { gallery?: any[] }>(projects: T[]): T[] =>
  (projects || []).map(project => ({
    ...project,
    gallery: (project.gallery || []).map(image =>
      image?.processInfoHtml
        ? { ...image, processInfoHtml: sanitizeRichText(image.processInfoHtml) }
        : image
    ),
  }));
