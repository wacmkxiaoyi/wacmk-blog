import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  getConstrainedContextActionPosition,
  normalizeContextActionGroups,
} from "../../../core/index.ts";
import type { ContextActionPoint } from "../../../core/types.ts";
import type { ContextActionsMenuProps } from "./ContextActionsMenu.types.ts";
import styles from "./ContextActionsMenu.module.css";
import "../../theme/variables.css";

function pointsEqual(left: ContextActionPoint, right: ContextActionPoint) {
  return left.x === right.x && left.y === right.y;
}

export function ContextActionsMenu({
  open,
  point,
  groups,
  onClose,
  className,
  zIndex,
}: ContextActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const normalizedGroups = useMemo(
    () => normalizeContextActionGroups(groups),
    [groups],
  );
  const [position, setPosition] = useState(point);

  useEffect(() => {
    if (!open || !normalizedGroups.length) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    function handleViewportChange() {
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, normalizedGroups, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPosition(point);
  }, [open, point]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !normalizedGroups.length) {
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const nextPosition = getConstrainedContextActionPosition({
      point,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });

    if (!pointsEqual(position, nextPosition)) {
      setPosition(nextPosition);
    }
  }, [open, point, normalizedGroups, position]);

  if (!open || !normalizedGroups.length || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className={[styles.menu, "ca-menu", className || ""]
        .filter(Boolean)
        .join(" ")}
      style={{ left: position.x, top: position.y, zIndex }}
      role="menu"
      aria-orientation="vertical"
      data-context-actions-menu="true"
    >
      {normalizedGroups.map((group, groupIndex) => (
        <React.Fragment key={`group-${group.group}`}>
          {groupIndex > 0 ? (
            <div
              className={[styles.separator, "ca-separator"].join(" ")}
              role="separator"
              aria-hidden="true"
            />
          ) : null}
          {group.children.map((child) => (
            <button
              key={child.key}
              type="button"
              role="menuitem"
              disabled={Boolean(child.disabled)}
              className={[
                styles.item,
                "ca-item",
                child.danger ? styles.itemDanger : "",
                child.danger ? "ca-item-danger" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                try {
                  const result = child.onClick?.();
                  void result;
                } finally {
                  onClose();
                }
              }}
            >
              {child.icon ? (
                <span className={styles.icon} aria-hidden="true">
                  {child.icon}
                </span>
              ) : null}
              <span className={styles.label}>{child.label}</span>
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
}
