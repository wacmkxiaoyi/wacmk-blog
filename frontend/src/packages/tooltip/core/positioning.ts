import type {
  TooltipPlacement,
  TooltipPosition,
  TooltipPositionInput,
} from "./types.ts";

function getTopY(
  anchorRect: TooltipPositionInput["anchorRect"],
  tooltipHeight: number,
  offset: number,
) {
  return anchorRect.top - tooltipHeight - offset;
}

function getBottomY(
  anchorRect: TooltipPositionInput["anchorRect"],
  offset: number,
) {
  return anchorRect.top + anchorRect.height + offset;
}

function fitsOnTop(topY: number, spacing: number) {
  return topY >= spacing;
}

function fitsOnBottom(
  bottomY: number,
  tooltipHeight: number,
  viewportHeight: number,
  spacing: number,
) {
  return bottomY + tooltipHeight + spacing <= viewportHeight;
}

function resolvePlacement(
  preferredPlacement: TooltipPlacement,
  topY: number,
  bottomY: number,
  tooltipHeight: number,
  viewportHeight: number,
  spacing: number,
) {
  if (preferredPlacement === "top") {
    return fitsOnTop(topY, spacing) ||
      !fitsOnBottom(bottomY, tooltipHeight, viewportHeight, spacing)
      ? "top"
      : "bottom";
  }

  return fitsOnBottom(bottomY, tooltipHeight, viewportHeight, spacing) ||
    !fitsOnTop(topY, spacing)
    ? "bottom"
    : "top";
}

export function getTooltipPosition({
  anchorRect,
  tooltipSize,
  viewportWidth,
  viewportHeight,
  placement = "top",
  offset = 12,
  spacing = 12,
}: TooltipPositionInput): TooltipPosition {
  const centeredX =
    anchorRect.left + (anchorRect.width - tooltipSize.width) / 2;
  const maxX = Math.max(spacing, viewportWidth - tooltipSize.width - spacing);
  const x = Math.min(Math.max(spacing, centeredX), maxX);
  const topY = getTopY(anchorRect, tooltipSize.height, offset);
  const bottomY = getBottomY(anchorRect, offset);
  const resolvedPlacement = resolvePlacement(
    placement,
    topY,
    bottomY,
    tooltipSize.height,
    viewportHeight,
    spacing,
  );
  const rawY = resolvedPlacement === "top" ? topY : bottomY;
  const maxY = Math.max(spacing, viewportHeight - tooltipSize.height - spacing);

  return {
    x,
    y: Math.min(Math.max(spacing, rawY), maxY),
    placement: resolvedPlacement,
  };
}
