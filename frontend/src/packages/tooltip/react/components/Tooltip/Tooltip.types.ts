import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { TooltipPlacement } from "../../../core/types.ts";

export type TooltipProps = {
  children: ReactElement;
  content: ReactNode;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  placement?: TooltipPlacement;
  offset?: number;
  zIndex?: number;
  openDelay?: number;
  closeDelay?: number;
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
};
