import { useCallback, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type {
  ContextActionGroup,
  ContextActionPoint,
} from "../../core/index.ts";
import { ContextActionsMenu } from "../components/ContextActionsMenu/index.ts";

type ContextMenuState = {
  open: boolean;
  point: ContextActionPoint;
  groups: ContextActionGroup[];
};

type ToggleContextActionsEvent =
  | Pick<
      MouseEvent,
      "clientX" | "clientY" | "preventDefault" | "stopPropagation"
    >
  | Pick<
      ReactMouseEvent,
      "clientX" | "clientY" | "preventDefault" | "stopPropagation"
    >;

export type UseContextActionsMenuOptions = {
  className?: string;
  zIndex?: number;
};

export type UseContextActionsMenuResult = {
  menu: ReactNode;
  toggleRightClick: (
    event: ToggleContextActionsEvent,
    groups: ContextActionGroup[],
  ) => void;
  openAt: (point: ContextActionPoint, groups: ContextActionGroup[]) => void;
  closeRightClick: () => void;
  isOpen: boolean;
};

const DEFAULT_STATE: ContextMenuState = {
  open: false,
  point: { x: 0, y: 0 },
  groups: [],
};

export function useContextActionsMenu(
  options: UseContextActionsMenuOptions = {},
): UseContextActionsMenuResult {
  const [state, setState] = useState<ContextMenuState>(DEFAULT_STATE);

  const closeRightClick = useCallback(() => {
    setState((current) => {
      if (!current.open) {
        return current;
      }
      return { ...current, open: false, groups: [] };
    });
  }, []);

  const openAt = useCallback(
    (point: ContextActionPoint, groups: ContextActionGroup[]) => {
      if (!Array.isArray(groups) || !groups.length) {
        setState(DEFAULT_STATE);
        return;
      }

      setState({
        open: true,
        point,
        groups,
      });
    },
    [],
  );

  const toggleRightClick = useCallback(
    (event: ToggleContextActionsEvent, groups: ContextActionGroup[]) => {
      event.preventDefault();
      event.stopPropagation();
      openAt({ x: event.clientX, y: event.clientY }, groups);
    },
    [openAt],
  );

  const menu = useMemo(
    () => (
      <ContextActionsMenu
        open={state.open}
        point={state.point}
        groups={state.groups}
        onClose={closeRightClick}
        className={options.className}
        zIndex={options.zIndex}
      />
    ),
    [
      closeRightClick,
      options.className,
      options.zIndex,
      state.groups,
      state.open,
      state.point,
    ],
  );

  return {
    menu,
    toggleRightClick,
    openAt,
    closeRightClick,
    isOpen: state.open,
  };
}
