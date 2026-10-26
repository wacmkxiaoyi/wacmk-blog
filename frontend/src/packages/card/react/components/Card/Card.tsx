import React from "react";
import styles from "./Card.module.css";
import type { CardProps } from "./Card.types.ts";
import "../../theme/variables.css";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function hasRenderableNode(node: React.ReactNode) {
  return node !== null && node !== undefined && node !== false;
}

function normalizeDimension(value?: number | string) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
}

function resolveTopRowHeight(
  contentHeight?: number | string,
  sideHeight?: number | string,
) {
  if (contentHeight == null) {
    return normalizeDimension(sideHeight);
  }
  if (sideHeight == null) {
    return normalizeDimension(contentHeight);
  }

  if (typeof contentHeight === "number" && typeof sideHeight === "number") {
    return `${Math.max(contentHeight, sideHeight)}px`;
  }

  return `max(${normalizeDimension(contentHeight)}, ${normalizeDimension(sideHeight)})`;
}

export function Card({
  content,
  bottomContent,
  sideContent,
  sidePosition = "right",
  className,
  contentClassName,
  bottomClassName,
  sideClassName,
  interactive = true,
  tone = "default",
  gap,
  contentWidth,
  contentHeight,
  sideWidth,
  sideHeight,
  bottomWidth,
  bottomHeight,
  style,
  contentStyle,
  bottomStyle,
  sideStyle,
}: CardProps) {
  const hasBottomContent = hasRenderableNode(bottomContent);
  const hasSideContent = hasRenderableNode(sideContent);
  const isSingleColumnLayout = !hasSideContent;
  const topRowHeight = hasSideContent
    ? resolveTopRowHeight(contentHeight, sideHeight)
    : normalizeDimension(contentHeight);
  const normalizedContentWidth = normalizeDimension(contentWidth);
  const normalizedContentHeight = normalizeDimension(contentHeight);
  const normalizedSideWidth = normalizeDimension(sideWidth);
  const normalizedBottomWidth = normalizeDimension(bottomWidth);
  const normalizedBottomHeight = normalizeDimension(bottomHeight);
  const layoutStyle: React.CSSProperties = {
    ...(gap != null ? { "--card-layout-gap": normalizeDimension(gap) } : null),
    ...(normalizedContentWidth != null
      ? { "--card-content-width": normalizedContentWidth }
      : null),
    ...(normalizedSideWidth != null
      ? { "--card-side-width": normalizedSideWidth }
      : null),
  } as React.CSSProperties;
  const rootStyle: React.CSSProperties = {
    ...(isSingleColumnLayout && normalizedContentWidth != null
      ? { "--card-root-width": normalizedContentWidth }
      : null),
    ...style,
  } as React.CSSProperties;

  const rootClassName = joinClassNames(
    styles.card,
    interactive && styles.interactive,
    tone === "soft" && styles.toneSoft,
    tone === "cover" && styles.toneCover,
    className,
  );

  const contentSlotClassName = joinClassNames(styles.content, contentClassName);
  const bottomSlotClassName = joinClassNames(styles.bottom, bottomClassName);
  const sideSlotClassName = joinClassNames(
    styles.side,
    hasSideContent && styles.topAligned,
    sideClassName,
  );
  const bodyClassName = joinClassNames(
    styles.layout,
    hasBottomContent && styles.withBottom,
    hasSideContent && styles.withSide,
    hasSideContent && sidePosition === "left" && styles.sideLeft,
  );

  return (
    <article className={rootClassName} style={rootStyle}>
      <div className={bodyClassName} style={layoutStyle}>
        <div
          className={joinClassNames(
            contentSlotClassName,
            hasSideContent && styles.topAligned,
          )}
          style={{
            width: hasSideContent ? undefined : "100%",
            height: hasSideContent ? topRowHeight : normalizedContentHeight,
            ...contentStyle,
          }}
        >
          <div className={styles.slotInner}>{content}</div>
        </div>
        {hasBottomContent ? (
          <div
            className={bottomSlotClassName}
            style={{
              width: hasSideContent ? "100%" : normalizedBottomWidth,
              height: normalizedBottomHeight,
              ...bottomStyle,
            }}
          >
            <div className={styles.slotInner}>{bottomContent}</div>
          </div>
        ) : null}
        {hasSideContent ? (
          <aside
            className={sideSlotClassName}
            style={{
              height: topRowHeight,
              ...sideStyle,
            }}
          >
            <div className={styles.slotInner}>{sideContent}</div>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
