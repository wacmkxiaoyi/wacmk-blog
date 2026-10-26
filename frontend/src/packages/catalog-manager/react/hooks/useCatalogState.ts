import { useCallback, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import type { Path } from "../../core/types.ts";

const APPEND_ZONE_HEIGHT = 18;

type DropPosition = "before" | "after" | "inside" | "append" | null;

export type DragState = {
  path: Path | null;
};

export type DropState = {
  path: Path | null;
  position: DropPosition;
};

export function useCatalogDragDrop() {
  const [dragState, setDragState] = useState<DragState>({ path: null });
  const [dropState, setDropState] = useState<DropState>({
    path: null,
    position: null,
  });
  const dragPathRef = useRef<Path | null>(null);

  const handleDragStart = useCallback(
    (e: ReactDragEvent<HTMLElement>, path: Path) => {
      dragPathRef.current = path;
      setDragState({ path });

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(path));

      const el = e.currentTarget as HTMLElement;
      requestAnimationFrame(() => {
        el.classList.add("is-dragging");
      });
    },
    [],
  );

  const handleDragEnd = useCallback((_e: ReactDragEvent<HTMLElement>) => {
    dragPathRef.current = null;
    setDragState({ path: null });
    setDropState({ path: null, position: null });
  }, []);

  const calculateDropPosition = useCallback(
    (
      e: ReactDragEvent<HTMLElement>,
      path: Path,
      isGroup: boolean,
    ): DropPosition => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = y / rect.height;

      if (ratio < 0.3) {
        return "before";
      }

      if (ratio < 0.7 && isGroup) {
        return "inside";
      }

      return "after";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: ReactDragEvent<HTMLElement>, path: Path, isGroup: boolean) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const position = calculateDropPosition(e, path, isGroup);
      setDropState({ path, position });
    },
    [calculateDropPosition],
  );

  const handleDragLeave = useCallback((e?: ReactDragEvent<HTMLElement>) => {
    if (
      e?.currentTarget &&
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    ) {
      return;
    }
    setDropState({ path: null, position: null });
  }, []);

  const handleContainerDragOver = useCallback(
    (e: ReactDragEvent<HTMLElement>, path: Path) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = e.currentTarget.getBoundingClientRect();
      const offset = rect.bottom - e.clientY;
      if (offset > APPEND_ZONE_HEIGHT) {
        return;
      }

      setDropState({ path, position: "append" });
    },
    [],
  );

  const clearDropState = useCallback(() => {
    setDropState({ path: null, position: null });
  }, []);

  const getDragPath = useCallback(() => dragPathRef.current, []);

  return {
    dragState,
    dropState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleContainerDragOver,
    handleDragLeave,
    getDragPath,
    setDropState,
    clearDropState,
  };
}

export function getDropIndicatorClass(
  currentPath: Path | null,
  dropState: DropState,
): string {
  if (!dropState.path || !currentPath) {
    return "";
  }

  if (dropState.path.length !== currentPath.length) {
    return "";
  }

  for (let i = 0; i < dropState.path.length; i++) {
    if (dropState.path[i] !== currentPath[i]) {
      return "";
    }
  }

  switch (dropState.position) {
    case "before":
      return "is-drop-before";
    case "after":
      return "is-drop-after";
    case "inside":
      return "is-drop-inside";
    case "append":
      return "is-drop-append";
    default:
      return "";
  }
}
