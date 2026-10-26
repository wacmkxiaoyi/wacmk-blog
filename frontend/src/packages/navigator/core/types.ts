export interface Position {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

export type PositionPreset =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface NavigateNode {
  key: string;
  label: string;
  level?: number;
  clickable?: boolean;
  defaultCollapsed?: boolean;
  children?: NavigateNode[];
  active?: boolean;
  data?: any;
  icon?: any;
  badge?: string | any;
}

export interface NavigatorLabels {
  expandLabel?: string;
  collapseLabel?: string;
  heading?: string;
}

export interface NavigatorCoreProps {
  items: NavigateNode[];
  onNavigate?: (node: NavigateNode, event: any) => void;
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
  style?: any;
  compactIcon?: any;
  anchorSide?: "left" | "right";
  anchorElement?: HTMLElement | null;
  anchorOffset?: number;
  collapseBoundaryElement?: HTMLElement | null;
}

export interface ClampedPosition {
  left: number;
  top: number;
}

export interface UseNavigatorPositionOptions {
  initialPosition?: PositionPreset | Position;
  minPageWidth?: number;
  minPageHeight?: number;
  expandedWidth?: number | string;
  expandedHeight?: number | string;
  margin?: number;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  storageKey?: string;
  embedded?: boolean;
  anchorSide?: "left" | "right";
  anchorElement?: HTMLElement | null;
  anchorOffset?: number;
  collapseBoundaryElement?: HTMLElement | null;
}

export interface UseNavigatorPositionResult {
  position: ClampedPosition;
  isCompact: boolean;
  isPanelOpen: boolean;
  isDragging: boolean;
  togglePanel: () => void;
  toggleRef: any;
  panelRef: any;
  rootRef: any;
  handlePointerDown: any;
  handlePointerMove: any;
  handlePointerUp: any;
  handleToggleClick: any;
  panelDirection: "left" | "right";
  anchorSide: "left" | "right";
}
