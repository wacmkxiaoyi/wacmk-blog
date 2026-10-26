import { useMemo } from "react";
import { resolveNavigatorLabel, getNavigatorLang } from "../../../core/i18n";
import type { NavigatorLabels } from "../../../core/types";
import { useNavigatorPosition } from "../../hooks/useNavigatorPosition";
import { NavigatorTree } from "../NavigatorTree";
import type { NavigatorProps } from "./Navigator.types";
import "../../theme/variables.css";
import styles from "./Navigator.module.css";

function mergeLabels(
  builtin: NavigatorLabels,
  overrides?: NavigatorLabels,
): NavigatorLabels {
  if (!overrides) return builtin;
  return { ...builtin, ...overrides };
}

function getBuiltinLabels(): NavigatorLabels {
  const lang = getNavigatorLang();
  return {
    expandLabel: resolveNavigatorLabel("navigator.expand", lang),
    collapseLabel: resolveNavigatorLabel("navigator.collapse", lang),
    heading: resolveNavigatorLabel("navigator.heading", lang),
  };
}

export default function Navigator({
  items,
  onNavigate,
  initialPosition,
  minPageWidth,
  minPageHeight,
  expandedWidth,
  expandedHeight,
  margin,
  zIndex,
  defaultCollapsed,
  collapsed,
  onCollapseChange,
  storageKey,
  labels,
  className,
  style,
  currentKey,
  embedded = false,
  compactIcon,
  anchorSide,
  anchorElement,
  anchorOffset,
  collapseBoundaryElement,
}: NavigatorProps) {
  const {
    position,
    isCompact,
    isPanelOpen,
    isDragging,
    toggleRef,
    panelRef,
    rootRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleToggleClick,
    panelDirection,
    anchorSide: resolvedAnchorSide,
  } = useNavigatorPosition({
    initialPosition,
    minPageWidth,
    minPageHeight,
    expandedWidth,
    expandedHeight,
    margin,
    defaultCollapsed,
    collapsed,
    onCollapseChange,
    storageKey,
    embedded,
    anchorSide,
    anchorElement,
    anchorOffset,
    collapseBoundaryElement,
  });

  const mergedLabels = useMemo(
    () => mergeLabels(getBuiltinLabels(), labels),
    [labels],
  );

  const rootStyle: React.CSSProperties = embedded
    ? { ...style }
    : {
        top: position.top,
        left: position.left,
        right: "auto",
        bottom: "auto",
        zIndex: zIndex ?? undefined,
        transform:
          resolvedAnchorSide === "right" ? "translateX(-100%)" : undefined,
        ...style,
      };

  if (expandedWidth !== undefined && (embedded || !isCompact)) {
    rootStyle.width =
      typeof expandedWidth === "number" ? expandedWidth : expandedWidth;
  }
  if (expandedHeight !== undefined && embedded) {
    rootStyle.maxHeight =
      typeof expandedHeight === "number" ? expandedHeight : expandedHeight;
  }

  const rootClasses = [
    styles.root,
    embedded ? styles.embedded : "",
    !embedded && isCompact ? styles.compact : "",
    !embedded && isDragging ? styles.dragging : "",
    !embedded && resolvedAnchorSide === "right" ? styles.anchorRight : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClasses}
      style={rootStyle}
      role="complementary"
      aria-label={mergedLabels.heading || "Navigation"}
    >
      {/* Floating toggle button (visible in compact mode, hidden in embedded) */}
      {!embedded && (
        <button
          ref={toggleRef}
          type="button"
          className={`${styles.toggle} ${styles.toggleVisible} ${styles.toggleDetached}`}
          aria-label={
            !isCompact
              ? mergedLabels.collapseLabel
              : isPanelOpen
                ? mergedLabels.collapseLabel
                : mergedLabels.expandLabel
          }
          aria-expanded={!isCompact || isPanelOpen}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleToggleClick}
        >
          {compactIcon || (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
            >
              {isPanelOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          )}
        </button>
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`${styles.panel} ${
          embedded || !isCompact || isPanelOpen
            ? styles.panelVisible
            : styles.panelHidden
        } ${!embedded && isCompact ? styles.panelCompact : ""} ${
          !embedded && isCompact
            ? panelDirection === "right"
              ? styles.panelRight
              : styles.panelLeft
            : ""
        } ${!embedded && !isCompact ? styles.panelExpanded : ""} ${embedded ? styles.panelEmbedded : ""}`}
      >
        <div className={styles.headingRow}>
          <strong className={styles.heading}>{mergedLabels.heading}</strong>
        </div>
        <div className={styles.scrollArea}>
          <NavigatorTree
            nodes={items}
            onNavigate={onNavigate}
            currentKey={currentKey}
          />
        </div>
      </div>
    </div>
  );
}
