import type { TextMark } from "../schema";

export function normalizeMarks(marks: TextMark[] | undefined) {
  if (!marks || !marks.length) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  marks.forEach((mark) => {
    const key = JSON.stringify(mark);
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(mark);
    }
  });

  return normalized;
}
