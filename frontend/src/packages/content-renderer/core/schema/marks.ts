export type TextColorToken =
  "berry" | "rose" | "orange" | "gold" | "green" | "cyan" | "blue" | "purple";

export type TextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "strike" }
  | { type: "underline" }
  | { type: "color"; value: TextColorToken }
  | { type: "highlight"; value?: string };
