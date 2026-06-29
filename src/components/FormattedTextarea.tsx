import React, { useRef } from "react";

interface FormattedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const WRAP_TOOLS: { label: string; tag: string; title: string; style?: string }[] = [
  { label: "B", tag: "strong", title: "Bold", style: "font-bold" },
  { label: "I", tag: "em", title: "Italic", style: "italic" },
  { label: "U", tag: "u", title: "Underline", style: "underline" },
  { label: "H2", tag: "h2", title: "Heading", style: "font-bold" },
];

// A plain HTML-string textarea with a tiny formatting toolbar. Buttons wrap the current
// selection in the matching tag, so non-technical edits produce formatted HTML.
export const FormattedTextarea: React.FC<FormattedTextareaProps> = ({ value, onChange, placeholder, className }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (tag: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    onChange(value.slice(0, start) + open + selected + close + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + open.length;
      ta.setSelectionRange(pos, pos + selected.length);
    });
  };

  const insertList = () => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const items = (selected || "item").split("\n").map(l => `  <li>${l}</li>`).join("\n");
    const block = `<ul>\n${items}\n</ul>`;
    onChange(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => ta.focus());
  };

  const btnClass = "px-2.5 py-1 text-sm rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition";

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        {WRAP_TOOLS.map(t => (
          <button
            key={t.tag}
            type="button"
            title={t.title}
            onMouseDown={(e) => { e.preventDefault(); wrap(t.tag); }}
            className={btnClass}
          >
            <span className={t.style}>{t.label}</span>
          </button>
        ))}
        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => { e.preventDefault(); insertList(); }}
          className={btnClass}
        >
          • List
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
};
