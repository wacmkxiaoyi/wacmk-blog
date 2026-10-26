import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getTooltipPosition } from "../../../core/index.ts";
import type { TooltipPlacement } from "../../../core/types.ts";
import type { TooltipProps } from "./Tooltip.types.ts";
import styles from "./Tooltip.module.css";
import "../../theme/variables.css";

const DEFAULT_OPEN_DELAY = 80;
const DEFAULT_CLOSE_DELAY = 120;

function normalizeDimension(value?: number | string) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
}

export function Tooltip({
  children,
  content,
  width,
  height,
  backgroundColor = "#111111",
  placement = "top",
  offset = 12,
  zIndex = 2600,
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  defaultOpen = false,
  disabled = false,
  className,
  contentClassName,
  style,
}: TooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(defaultOpen && !disabled);
  const [mounted, setMounted] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] =
    useState<TooltipPlacement>(placement);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [positioned, setPositioned] = useState(false);

  function keepTooltipOpen() {
    clearCloseTimer();
    clearOpenTimer();
  }

  function clearOpenTimer() {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }

  function clearCloseTimer() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openTooltip() {
    if (disabled) {
      return;
    }
    keepTooltipOpen();
    openTimerRef.current = window.setTimeout(
      () => {
        setPositioned(false);
        setOpen(true);
      },
      Math.max(0, openDelay),
    );
  }

  function closeTooltip() {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(
      () => {
        setOpen(false);
      },
      Math.max(0, closeDelay),
    );
  }

  useEffect(() => {
    setMounted(true);
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleViewportChange() {
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) {
      return;
    }

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const nextPosition = getTooltipPosition({
      anchorRect: {
        left: anchorRect.left,
        top: anchorRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      },
      tooltipSize: {
        width: tooltipRect.width,
        height: tooltipRect.height,
      },
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      placement,
      offset,
    });

    setPosition({ x: nextPosition.x, y: nextPosition.y });
    setResolvedPlacement(nextPosition.placement);
    setPositioned(true);
  }, [open, mounted, placement, offset, content, width, height]);

  const trigger = React.cloneElement(children, {
    "aria-describedby": open ? tooltipId : undefined,
  });

  const anchorClassName = styles.anchor;
  const tooltipClassName = [
    styles.tooltip,
    resolvedPlacement === "top" ? styles.tooltipTop : styles.tooltipBottom,
    className || "",
  ]
    .filter(Boolean)
    .join(" ");
  const mergedContentClassName = [styles.tooltipContent, contentClassName || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      ref={anchorRef}
      className={anchorClassName}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onFocus={openTooltip}
      onBlur={(event) => {
        if (tooltipRef.current?.contains(event.relatedTarget)) {
          return;
        }
        closeTooltip();
      }}
    >
      {trigger}
      {mounted && open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={tooltipClassName}
              style={{
                left: position.x,
                top: position.y,
                width: normalizeDimension(width),
                height: normalizeDimension(height),
                backgroundColor,
                zIndex,
                ...style,
                visibility: positioned ? undefined : "hidden",
              }}
              onMouseEnter={keepTooltipOpen}
              onMouseLeave={closeTooltip}
              onFocus={keepTooltipOpen}
              onBlur={(event) => {
                if (tooltipRef.current?.contains(event.relatedTarget)) {
                  return;
                }
                closeTooltip();
              }}
              data-tooltip-placement={resolvedPlacement}
            >
              <div className={styles.arrow} aria-hidden="true" />
              <div className={mergedContentClassName}>{content}</div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
