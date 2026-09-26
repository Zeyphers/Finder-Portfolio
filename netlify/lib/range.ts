// Parses a single-range HTTP `Range` header ("bytes=0-1", "bytes=500-",
// "bytes=-500") against a body of `size` bytes. Safari won't play a <video>
// unless the server answers these with 206 Partial Content.
//
// Returns the inclusive byte span to send, null to send the whole body (no
// header, a non-byte unit, or a multi-range request we don't bother with), or
// "unsatisfiable" for a range that starts past the end (→ 416).
export function parseByteRange(
  header: string | null,
  size: number
): { start: number; end: number } | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix range: the last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
