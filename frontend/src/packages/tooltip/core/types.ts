export type TooltipPlacement = "top" | "bottom";

export type TooltipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TooltipSize = {
  width: number;
  height: number;
};

export type TooltipPositionInput = {
  anchorRect: TooltipRect;
  tooltipSize: TooltipSize;
  viewportWidth: number;
  viewportHeight: number;
  placement?: TooltipPlacement;
  offset?: number;
  spacing?: number;
};

export type TooltipPosition = {
  x: number;
  y: number;
  placement: TooltipPlacement;
};
