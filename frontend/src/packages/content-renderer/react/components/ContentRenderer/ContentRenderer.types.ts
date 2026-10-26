import type {
  ContentAdapter,
  ContentFormat,
  ContentPlugin,
} from "../../../core";
import type {
  CustomRendererRegistry,
  RendererComponentRegistry,
} from "../../registry";

export type ContentRendererProps = {
  format: ContentFormat;
  value: unknown;
  mode?: "article" | "compact" | "preview";
  adapter?: ContentAdapter;
  components?: Partial<RendererComponentRegistry>;
  plugins?: ContentPlugin[];
  theme?: Record<string, unknown>;
  resolvers?: Record<string, unknown>;
  options?: Record<string, unknown>;
  className?: string;
  labels?: Record<string, string>;
  customComponents?: CustomRendererRegistry;
  resolveCustomComponent?: (
    node: unknown,
    context: unknown,
  ) => React.ComponentType<any> | null;
  adapterRegistry?: Partial<Record<ContentFormat, ContentAdapter>>;
  onDocument?: (document: unknown) => void;
};
