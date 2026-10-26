import type { ContentDocument, ContentFormat } from "../schema";

export type AdapterContext = {
  format: ContentFormat;
  options?: Record<string, unknown>;
};

export type ContentAdapter<Input = unknown> = {
  format: ContentFormat;
  parse(input: Input, context?: AdapterContext): ContentDocument;
};
