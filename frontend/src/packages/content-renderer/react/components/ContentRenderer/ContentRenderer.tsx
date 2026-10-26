import React, { useEffect, useId, useMemo, useRef } from "react";
import { createDocument, createRenderContext } from "../../../core";
import { ContentProvider } from "../ContentProvider";
import { defaultRenderers, mergeRenderers } from "../../registry";
import { renderBlockChildren } from "../../utils";
import {
  buildScopedHeadingDomId,
  navigateToContentHeading,
} from "../../navigation";
import styles from "./ContentRenderer.module.css";
import "../../theme/variables.css";

function buildContentDocumentMeta(document) {
  const equationIdsByPath = {};
  const equationNumbersByPath = {};
  let equationNumber = 0;

  function visitBlocks(nodes, parentPath = "") {
    for (
      let index = 0;
      index < (Array.isArray(nodes) ? nodes.length : 0);
      index += 1
    ) {
      const node = nodes[index];
      const path = parentPath ? `${parentPath}.${index}` : String(index);
      if (!node) {
        continue;
      }

      if (node.type === "math-block") {
        equationNumber += 1;
        equationIdsByPath[path] = `equation-${equationNumber}`;
        equationNumbersByPath[path] = equationNumber;
      }

      if (Array.isArray(node.children)) {
        visitBlocks(node.children, `${path}.children`);
      }

      if (Array.isArray(node.items)) {
        node.items.forEach((item, itemIndex) => {
          visitBlocks(item?.children, `${path}.items.${itemIndex}.children`);
        });
      }
    }
  }

  visitBlocks(document?.children || []);
  return { equationIdsByPath, equationNumbersByPath };
}

export function ContentRenderer({
  format,
  value,
  mode = "article",
  adapter,
  components,
  plugins,
  theme,
  resolvers,
  options,
  className,
  labels,
  customComponents,
  resolveCustomComponent,
  adapterRegistry,
  onDocument,
  anchorNavigation,
  anchorInstanceId,
}) {
  const registry = useMemo(
    () => mergeRenderers(defaultRenderers, components),
    [components],
  );
  const document = useMemo(
    () => createDocument({ format, value, adapter, adapterRegistry, plugins }),
    [format, value, adapter, adapterRegistry, plugins],
  );
  const documentMeta = useMemo(
    () => buildContentDocumentMeta(document),
    [document],
  );
  const rootRef = useRef(null);
  const reactId = useId();
  const instanceId = useMemo(
    () =>
      String(anchorInstanceId || reactId || "content-renderer").replace(
        /[^a-zA-Z0-9_-]/g,
        "",
      ),
    [anchorInstanceId, reactId],
  );
  const anchorConfig = useMemo(
    () => ({
      enabled: anchorNavigation?.enabled !== false,
      offsetTop: anchorNavigation?.offsetTop || 0,
      updateHash: anchorNavigation?.updateHash !== false,
      focus: Boolean(anchorNavigation?.focus),
      behavior: anchorNavigation?.behavior || "smooth",
    }),
    [anchorNavigation],
  );
  const anchors = useMemo(
    () => ({
      instanceId,
      rootRef,
      navigation: anchorConfig,
      resolveHeadingDomId: (headingId) =>
        buildScopedHeadingDomId(headingId, instanceId),
      navigateToHeading: (headingId, overrides = {}) =>
        navigateToContentHeading(headingId, {
          root: rootRef.current || undefined,
          offsetTop: anchorConfig.offsetTop,
          updateHash: anchorConfig.updateHash,
          focus: anchorConfig.focus,
          behavior: anchorConfig.behavior,
          instanceId,
          ...overrides,
        }),
    }),
    [anchorConfig, instanceId],
  );
  const context = useMemo(
    () =>
      createRenderContext({
        registry,
        theme,
        resolvers,
        labels,
        options,
        mode,
        customComponents,
        resolveCustomComponent,
        anchors,
        document: documentMeta,
      }),
    [
      registry,
      theme,
      resolvers,
      labels,
      options,
      mode,
      customComponents,
      resolveCustomComponent,
      anchors,
      documentMeta,
    ],
  );

  useEffect(() => {
    if (typeof onDocument === "function") {
      onDocument(document);
    }
  }, [document, onDocument]);

  return (
    <ContentProvider value={context}>
      <div
        ref={rootRef}
        className={[styles.renderer, styles[`mode-${mode}`], className || ""]
          .filter(Boolean)
          .join(" ")}
      >
        {renderBlockChildren(document.children, context)}
      </div>
    </ContentProvider>
  );
}
