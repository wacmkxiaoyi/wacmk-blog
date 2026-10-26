import type React from "react";
import type {
  NavigateNode,
  NavigatorLabels,
  Position,
  PositionPreset,
} from "../../../core/types";

export interface NavigatorProps {
  items: NavigateNode[];
  onNavigate?: (node: NavigateNode, event: React.MouseEvent) => void;
  initialPosition?: PositionPreset | Position;
  minPageWidth?: number;
  minPageHeight?: number;
  expandedWidth?: number | string;
  expandedHeight?: number | string;
  margin?: number;
  zIndex?: number;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  storageKey?: string;
  labels?: NavigatorLabels;
  className?: string;
  style?: React.CSSProperties;
  currentKey?: string;
  embedded?: boolean;
  compactIcon?: React.ReactNode;
  /** Which edge of the toggle the fixed position represents. */
  anchorSide?: "left" | "right";
  /** Element used to calculate the navigator's initial anchor position. */
  anchorElement?: HTMLElement | null;
  /** Distance between the anchor element edge and the toggle anchor edge. */
  anchorOffset?: number;
  /** Element edge beyond which responsive repositioning collapses the panel. */
  collapseBoundaryElement?: HTMLElement | null;
}
