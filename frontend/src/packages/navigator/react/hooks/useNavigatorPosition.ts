import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseNavigatorPositionOptions,
  UseNavigatorPositionResult,
  ClampedPosition,
} from "../../core/types";

const DEFAULT_MARGIN = 16;
const DEFAULT_TOGGLE_SIZE = 48;
const DEFAULT_EXPANDED_WIDTH = 300;
const DEFAULT_EXPANDED_HEIGHT = 640;
const DEFAULT_TOP_OFFSET = 88;
const DRAG_THRESHOLD = 4;

function dimension(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampCompact(position, margin, height, anchorSide) {
  if (typeof window === "undefined") return position;
  const minLeft =
    anchorSide === "right" ? margin + DEFAULT_TOGGLE_SIZE : margin;
  const maxLeft =
    anchorSide === "right"
      ? window.innerWidth - margin
      : window.innerWidth - DEFAULT_TOGGLE_SIZE - margin;
  return {
    left: Math.min(Math.max(position.left, minLeft), maxLeft),
    top: Math.min(
      Math.max(position.top, margin),
      Math.max(margin, window.innerHeight - height - margin),
    ),
  };
}

function loadPosition(storageKey, margin, height, anchorSide) {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const position = JSON.parse(
      window.localStorage.getItem(storageKey) || "null",
    );
    return position &&
      typeof position.left === "number" &&
      typeof position.top === "number"
      ? clampCompact(position, margin, height, anchorSide)
      : null;
  } catch (_error) {
    return null;
  }
}

function savePosition(storageKey, position) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(position));
  } catch (_error) {
    // Ignore unavailable localStorage.
  }
}

function presetPosition(preset, margin, anchorSide) {
  const width = typeof window === "undefined" ? 1440 : window.innerWidth;
  const height = typeof window === "undefined" ? 900 : window.innerHeight;
  const left =
    preset === "top-left" || preset === "bottom-left"
      ? anchorSide === "right"
        ? margin + DEFAULT_TOGGLE_SIZE
        : margin
      : anchorSide === "right"
        ? width - margin
        : width - DEFAULT_TOGGLE_SIZE - margin;
  return {
    left,
    top:
      preset === "bottom-left" || preset === "bottom-right"
        ? Math.max(margin, height - DEFAULT_TOGGLE_SIZE - margin)
        : DEFAULT_TOP_OFFSET,
  };
}

function resolveInitialPosition(initialPosition, margin, anchorSide) {
  if (initialPosition && typeof initialPosition === "object") {
    return {
      left:
        typeof initialPosition.left === "number"
          ? initialPosition.left
          : margin,
      top:
        typeof initialPosition.top === "number"
          ? initialPosition.top
          : DEFAULT_TOP_OFFSET,
    };
  }
  return presetPosition(initialPosition, margin, anchorSide);
}

function initiallyCompact(options) {
  if (typeof window === "undefined" || options.embedded) return false;
  return (
    options.collapsed === true ||
    (options.minPageWidth > 0 && window.innerWidth < options.minPageWidth) ||
    (options.minPageHeight > 0 && window.innerHeight < options.minPageHeight)
  );
}

export function useNavigatorPosition(options = {}): UseNavigatorPositionResult {
  const {
    initialPosition,
    minPageWidth = 0,
    minPageHeight = 0,
    expandedWidth,
    expandedHeight,
    margin = DEFAULT_MARGIN,
    defaultCollapsed = false,
    collapsed: controlledCollapsed,
    onCollapseChange,
    storageKey,
    embedded = false,
    anchorSide = "left",
    anchorElement,
    anchorOffset = margin,
    collapseBoundaryElement,
  } = options as UseNavigatorPositionOptions;
  const panelWidth = dimension(expandedWidth, DEFAULT_EXPANDED_WIDTH);
  const panelHeight = dimension(expandedHeight, DEFAULT_EXPANDED_HEIGHT);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ left: 0, top: 0 });
  const pointerOffsetRef = useRef({ x: 0, y: 0 });
  const toggleOffsetRef = useRef({ y: 0 });
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const skipAutoCompactRef = useRef(false);
  const positionRef = useRef<ClampedPosition>({ left: 0, top: 0 });
  const restoredRef = useRef(false);
  const initialPositionRef = useRef(initialPosition);
  const anchoredElementRef = useRef<HTMLElement | null>(null);
  const isCompactRef = useRef(false);
  const [isCompact, setIsCompact] = useState(() =>
    initiallyCompact({
      embedded,
      collapsed: controlledCollapsed,
      minPageWidth,
      minPageHeight,
    }),
  );
  const [isPanelOpen, setIsPanelOpen] = useState(
    () =>
      embedded ||
      (!initiallyCompact({
        embedded,
        collapsed: controlledCollapsed,
        minPageWidth,
        minPageHeight,
      }) &&
        !defaultCollapsed),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<ClampedPosition>(() => {
    const restored = loadPosition(
      storageKey,
      margin,
      DEFAULT_TOGGLE_SIZE,
      anchorSide,
    );
    if (restored) {
      restoredRef.current = true;
      return restored;
    }
    const next = clampCompact(
      resolveInitialPosition(initialPosition, margin, anchorSide),
      margin,
      DEFAULT_TOGGLE_SIZE,
      anchorSide,
    );
    positionRef.current = next;
    return next;
  });
  isCompactRef.current = isCompact;

  const anchoredPosition = useCallback(() => {
    if (!anchorElement) return null;
    const rect = anchorElement.getBoundingClientRect();
    return {
      left:
        anchorSide === "right"
          ? rect.left - anchorOffset
          : rect.right + anchorOffset,
      top: DEFAULT_TOP_OFFSET,
    };
  }, [anchorElement, anchorOffset, anchorSide]);

  const fitExpandedPosition = useCallback(
    (next: ClampedPosition) => {
      if (typeof window === "undefined") return true;
      const boundary = collapseBoundaryElement?.getBoundingClientRect();
      if (anchorSide === "right") {
        const fittedLeft = Math.max(next.left, panelWidth + margin);
        return {
          position: { ...next, left: fittedLeft },
          compact: Boolean(boundary && fittedLeft >= boundary.left),
        };
      }
      const fittedLeft = Math.min(
        next.left,
        window.innerWidth - panelWidth - margin,
      );
      return {
        position: { ...next, left: fittedLeft },
        compact: Boolean(boundary && fittedLeft <= boundary.right),
      };
    },
    [anchorSide, collapseBoundaryElement, margin, panelWidth],
  );

  const collapse = useCallback(() => {
    setIsCompact(true);
    setIsPanelOpen(false);
    onCollapseChange?.(true);
  }, [onCollapseChange]);

  useEffect(() => {
    if (embedded) {
      setIsCompact(false);
      setIsPanelOpen(true);
    } else if (controlledCollapsed === true) {
      collapse();
    } else if (controlledCollapsed === false) {
      setIsCompact(false);
      setIsPanelOpen(true);
    }
  }, [collapse, controlledCollapsed, embedded]);

  useEffect(() => {
    if (embedded || restoredRef.current) return;
    if (initialPositionRef.current !== initialPosition) {
      initialPositionRef.current = initialPosition;
      setPosition(
        clampCompact(
          resolveInitialPosition(initialPosition, margin, anchorSide),
          margin,
          DEFAULT_TOGGLE_SIZE,
          anchorSide,
        ),
      );
    }
  }, [anchorSide, embedded, initialPosition, margin]);

  useEffect(() => {
    if (embedded || typeof window === "undefined") return;
    const updateInitialAnchor = () => {
      if (anchoredElementRef.current === anchorElement) return;
      anchoredElementRef.current = anchorElement || null;
      const anchored = anchoredPosition();
      if (!anchored) return;
      setPosition((current) => {
        const next = clampCompact(
          anchored,
          margin,
          DEFAULT_TOGGLE_SIZE,
          anchorSide,
        );
        const fitted = isCompactRef.current
          ? { position: next, compact: false }
          : fitExpandedPosition(next);
        positionRef.current = fitted.position;
        if (!isCompactRef.current && fitted.compact) collapse();
        return fitted.position;
      });
    };
    updateInitialAnchor();
  }, [
    anchorElement,
    anchorSide,
    anchoredPosition,
    collapse,
    embedded,
    fitExpandedPosition,
    margin,
  ]);

  useEffect(() => {
    if (embedded || typeof window === "undefined") return;
    const updateForResize = () => {
      setPosition((current) => {
        const next = clampCompact(
          current,
          margin,
          DEFAULT_TOGGLE_SIZE,
          anchorSide,
        );
        const fitted = isCompactRef.current
          ? { position: next, compact: false }
          : fitExpandedPosition(next);
        positionRef.current = fitted.position;
        if (
          !isCompactRef.current &&
          !skipAutoCompactRef.current &&
          fitted.compact
        ) {
          collapse();
        }
        return fitted.position;
      });
      skipAutoCompactRef.current = false;
    };
    window.addEventListener("resize", updateForResize);
    const observer =
      anchorElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateForResize)
        : null;
    observer?.observe(anchorElement);
    return () => {
      window.removeEventListener("resize", updateForResize);
      observer?.disconnect();
    };
  }, [
    anchorElement,
    anchorSide,
    collapse,
    embedded,
    fitExpandedPosition,
    margin,
  ]);

  const togglePanel = useCallback(() => {
    if (embedded) return;
    const nextCompact = !isCompact;
    if (!nextCompact) skipAutoCompactRef.current = true;
    setIsCompact(nextCompact);
    setIsPanelOpen(!nextCompact);
    onCollapseChange?.(nextCompact);
  }, [embedded, isCompact, onCollapseChange]);

  const handlePointerDown = useCallback(
    (event) => {
      if (embedded) return;
      const rect = toggleRef.current?.getBoundingClientRect();
      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointerIdRef.current = event.pointerId;
      pointerOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      toggleOffsetRef.current = { y: (rootRect || rect).top - rect.top };
      dragStartRef.current = position;
      draggedRef.current = false;
      suppressClickRef.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [embedded, position],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (embedded || pointerIdRef.current !== event.pointerId) return;
      const next = clampCompact(
        {
          left:
            event.clientX -
            pointerOffsetRef.current.x +
            (anchorSide === "right" ? DEFAULT_TOGGLE_SIZE : 0),
          top:
            event.clientY -
            pointerOffsetRef.current.y +
            toggleOffsetRef.current.y,
        },
        margin,
        DEFAULT_TOGGLE_SIZE,
        anchorSide,
      );
      if (
        Math.abs(next.left - dragStartRef.current.left) >= DRAG_THRESHOLD ||
        Math.abs(next.top - dragStartRef.current.top) >= DRAG_THRESHOLD
      ) {
        draggedRef.current = true;
        setIsDragging(true);
      }
      setPosition(next);
      positionRef.current = next;
    },
    [anchorSide, embedded, margin],
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (embedded || pointerIdRef.current !== event.pointerId) return;
      pointerIdRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      suppressClickRef.current = draggedRef.current;
      setIsDragging(false);
      const finalPosition = positionRef.current;
      if (
        draggedRef.current &&
        !isCompact &&
        fitExpandedPosition(finalPosition).compact
      )
        collapse();
      savePosition(storageKey, finalPosition);
    },
    [collapse, embedded, fitExpandedPosition, isCompact, storageKey],
  );

  const handleToggleClick = useCallback(() => {
    if (embedded || isDragging) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    togglePanel();
  }, [embedded, isDragging, togglePanel]);

  return {
    position,
    isCompact,
    isPanelOpen,
    isDragging,
    togglePanel,
    toggleRef,
    panelRef,
    rootRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleToggleClick,
    panelDirection: anchorSide,
    anchorSide,
  };
}
