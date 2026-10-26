import type {
  ContextActionGroup,
  ContextActionPoint,
} from "../../../core/types.ts";

export type ContextActionsMenuProps = {
  open: boolean;
  point: ContextActionPoint;
  groups: ContextActionGroup[];
  onClose: () => void;
  className?: string;
  zIndex?: number;
};
