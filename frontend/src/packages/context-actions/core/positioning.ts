import type { ContextActionPoint } from "./types.ts";

type ConstrainedPositionInput = {
  point: ContextActionPoint;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  spacing?: number;
};

export function getConstrainedContextActionPosition({
  point,
  width,
  height,
  viewportWidth,
  viewportHeight,
  spacing = 12,
}: ConstrainedPositionInput): ContextActionPoint {
  let x = point.x;
  let y = point.y;

  if (x + width + spacing > viewportWidth) {
    x = Math.max(spacing, viewportWidth - width - spacing);
  }
  if (y + height + spacing > viewportHeight) {
    y = Math.max(spacing, viewportHeight - height - spacing);
  }

  return {
    x: Math.max(spacing, x),
    y: Math.max(spacing, y),
  };
}
