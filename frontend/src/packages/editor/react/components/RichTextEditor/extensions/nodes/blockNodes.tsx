import React, { useSyncExternalStore } from "react";
import { Selection } from "@tiptap/pm/state";
import { mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { AdmonitionIcon as RendererAdmonitionIcon } from "../../../../../../content-renderer/react/renderers/blocks/admonitionIcons.tsx";
import { ImageIcon, VideoIcon } from "../../../../icons/index.ts";
import type {
  CustomBlockRegistryRef,
  RichTextEditorBridgeRef,
} from "../../helpers/types.ts";
import {
  buildUniqueTabItems,
  setNodeAttrsAtPos,
} from "../../helpers/richTextEditorRuntime.ts";
import styles from "../../RichTextEditor.module.css";
import {
  buildBlockContextMenuGroups,
  buildTabsContextMenuGroups,
  createEditorBlockNode,
  renderNodeTag,
} from "../shared.tsx";

export function createAdmonitionBlockNode(_bridgeRef: RichTextEditorBridgeRef) {
  function AdmonitionView(props) {
    const attrs = props.node.attrs || {};
    const titleFallback = _bridgeRef.current.translate(
      "editor.placeholder.title",
      "Title",
    );
    const [expanded, setExpanded] = React.useState(
      attrs.collapsible === false ? true : attrs.defaultOpen !== false,
    );
    const [title, setTitle] = React.useState(String(attrs.title || ""));
    const className = `cr-admonition cr-admonition-${attrs.variant || "note"}`;

    React.useEffect(() => {
      setExpanded(
        attrs.collapsible === false ? true : attrs.defaultOpen !== false,
      );
    }, [attrs.collapsible, attrs.defaultOpen]);

    React.useEffect(() => {
      setTitle(String(attrs.title || ""));
    }, [attrs.title]);

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="admonitionBlock"
        className={[styles.blockNodeShell, styles.admonitionShell].join(" ")}
        style={{ marginLeft: `${Number(attrs.indent || 0) * 2}rem` }}
      >
        {attrs.collapsible === false ? (
          <div className={className}>
            <div className="cr-admonition-summary">
              <span className="cr-admonition-icon">
                <RendererAdmonitionIcon variant={attrs.variant || "note"} />
              </span>
              <input
                type="text"
                className={styles.rendererTitleInput}
                value={title}
                placeholder={titleFallback}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() =>
                  setNodeAttrsAtPos(props.editor, props.getPos(), {
                    title: title.trim(),
                  })
                }
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            <div className="cr-admonition-body">
              <NodeViewContent
                as="div"
                className={styles.nestedEditorContent}
              />
            </div>
          </div>
        ) : (
          <details className={className} open={expanded}>
            <summary
              className="cr-admonition-summary"
              onClick={(event) => {
                event.preventDefault();
                setExpanded((current) => !current);
              }}
            >
              <span className="cr-admonition-icon">
                <RendererAdmonitionIcon variant={attrs.variant || "note"} />
              </span>
              <input
                type="text"
                className={styles.rendererTitleInput}
                value={title}
                placeholder={titleFallback}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() =>
                  setNodeAttrsAtPos(props.editor, props.getPos(), {
                    title: title.trim(),
                  })
                }
                onClick={(event) => event.stopPropagation()}
              />
            </summary>
            <div className="cr-admonition-body">
              <NodeViewContent
                as="div"
                className={styles.nestedEditorContent}
              />
            </div>
          </details>
        )}
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("admonitionBlock", {
    group: "block",
    selectable: true,
    content: "block+",
    addAttributes() {
      return {
        variant: { default: "note" },
        title: { default: "" },
        collapsible: { default: true },
        defaultOpen: { default: true },
        indent: { default: 0 },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='admonition-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "admonition-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(AdmonitionView);
    },
    addCommands() {
      return {
        setAdmonitionBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}

export function createTabItemNode(bridgeRef: RichTextEditorBridgeRef) {
  function TabItemView(props) {
    const attrs = props.node.attrs || {};
    return (
      <NodeViewWrapper
        as="section"
        data-editor-node-type="tabItem"
        data-editor-tab-key={String(attrs.key || "")}
        className="cr-tab-panel"
      >
        <NodeViewContent as="div" className={styles.nestedEditorContent} />
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("tabItem", {
    content: "block+",
    selectable: true,
    addAttributes() {
      return {
        key: { default: "" },
        label: { default: "" },
      };
    },
    parseHTML() {
      return [{ tag: "section[data-editor-node='tab-item']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "section",
        mergeAttributes(HTMLAttributes, { "data-editor-node": "tab-item" }),
        0,
      ];
    },
    addNodeView() {
      return ReactNodeViewRenderer(TabItemView);
    },
  });
}

export function createTabsBlockNode(bridgeRef: RichTextEditorBridgeRef) {
  function TabsView(props) {
    const tabsPos = props.getPos();
    const titleFallback = bridgeRef.current.translate(
      "editor.placeholder.title",
      "Title",
    );
    const nodeItems = [];
    props.node.forEach((child) => {
      nodeItems.push(child);
    });
    let offset = 0;
    const items = buildUniqueTabItems(nodeItems).map((item) => {
      const nextItem = {
        index: item.index,
        key: item.key,
        reactKey: `${item.key}-${item.index}`,
        label: item.label,
        pos: tabsPos + offset + 1,
        nodeSize: item.node.nodeSize,
      };
      offset += item.node.nodeSize;
      return nextItem;
    });
    const [activeKey, setActiveKey] = React.useState(items[0]?.key || "");
    const [editingKey, setEditingKey] = React.useState<string | null>(null);
    const [draftLabels, setDraftLabels] = React.useState<
      Record<string, string>
    >({});
    const panelsRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      setActiveKey((current) =>
        items.some((item) => item.key === current)
          ? current
          : items[0]?.key || "",
      );
    }, [items]);

    React.useEffect(() => {
      setDraftLabels((current) => {
        const next = items.reduce<Record<string, string>>((result, item) => {
          result[item.key] =
            editingKey === item.key && current[item.key] != null
              ? current[item.key]
              : item.label;
          return result;
        }, {});
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(next);
        if (
          currentKeys.length === nextKeys.length &&
          nextKeys.every((key) => current[key] === next[key])
        ) {
          return current;
        }
        return next;
      });
    }, [editingKey, items]);

    React.useEffect(() => {
      function syncActiveTabFromSelection() {
        const from = props.editor.state.selection.from;
        const matchingItem = items.find(
          (item) => from >= item.pos && from <= item.pos + item.nodeSize,
        );
        if (matchingItem) {
          setActiveKey(matchingItem.key);
        }
      }

      syncActiveTabFromSelection();
      props.editor.on("selectionUpdate", syncActiveTabFromSelection);
      return () => {
        props.editor.off("selectionUpdate", syncActiveTabFromSelection);
      };
    }, [items, props.editor]);

    React.useEffect(() => {
      const panels =
        panelsRef.current?.querySelectorAll?.(
          "[data-editor-node-type='tabItem']",
        ) || [];
      panels.forEach((panel) => {
        const key = panel.getAttribute("data-editor-tab-key");
        const active = key === activeKey;
        panel.classList.toggle("is-active", active);
        panel.classList.toggle(styles.tabPanelActive, active);
        panel.classList.toggle(styles.tabPanelHidden, !active);
      });
    }, [activeKey, items]);

    function moveSelectionToTab(itemPos) {
      const state = props.editor?.state;
      const view = props.editor?.view;
      if (!state || !view || typeof itemPos !== "number") {
        return false;
      }

      const selectionPos = Math.min(itemPos + 1, state.doc.content.size);
      const transaction = state.tr.setSelection(
        Selection.near(state.doc.resolve(selectionPos), 1),
      );
      view.dispatch(transaction);
      props.editor.commands.focus(undefined, { scrollIntoView: false });
      return true;
    }

    function activateTab(item, nextEditingKey: string | null = null) {
      setActiveKey(item.key);
      setEditingKey(nextEditingKey);
      moveSelectionToTab(item.pos);
    }

    function commitTabLabel(itemKey, value) {
      const matchingItem = items.find((entry) => entry.key === itemKey);
      if (!matchingItem) {
        return;
      }
      setNodeAttrsAtPos(props.editor, matchingItem.pos, {
        label: value.trim(),
      });
      setEditingKey((current) => (current === itemKey ? null : current));
    }

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          ...buildBlockContextMenuGroups(
            props.editor,
            bridgeRef.current.translate,
          ),
          ...buildTabsContextMenuGroups({
            editor: props.editor,
            translate: bridgeRef.current.translate,
            tabsNode: props.node,
            tabsPos,
            target: event.target instanceof HTMLElement ? event.target : null,
          }),
        ],
      );
    }

    function handleTabPointerDown(event) {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="tabsBlock"
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(props.node.attrs.indent || 0) * 2}rem` }}
        onContextMenu={handleContextMenu}
      >
        <div className="cr-tabs">
          <div className="cr-tabs-nav" role="tablist">
            {items.map((item) =>
              editingKey === item.key ? (
                <div
                  key={item.reactKey}
                  role="tab"
                  tabIndex={0}
                  aria-selected={item.key === activeKey}
                  data-editor-tab-key={item.key}
                  className={`cr-tab-button${item.key === activeKey ? " is-active" : ""}`}
                  onClick={() => activateTab(item, item.key)}
                  onMouseDown={handleTabPointerDown}
                >
                  <input
                    type="text"
                    className={styles.rendererTabInput}
                    value={draftLabels[item.key] ?? item.label}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraftLabels((current) => ({
                        ...current,
                        [item.key]: nextValue,
                      }));
                    }}
                    onBlur={() =>
                      commitTabLabel(
                        item.key,
                        draftLabels[item.key] ?? item.label,
                      )
                    }
                    placeholder={titleFallback}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setDraftLabels((current) => ({
                          ...current,
                          [item.key]: item.label,
                        }));
                        setEditingKey(null);
                      }
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  key={item.reactKey}
                  type="button"
                  role="tab"
                  aria-selected={item.key === activeKey}
                  data-editor-tab-key={item.key}
                  className={`cr-tab-button${item.key === activeKey ? " is-active" : ""}`}
                  onMouseDown={handleTabPointerDown}
                  onClick={() => activateTab(item)}
                  onDoubleClick={() => activateTab(item, item.key)}
                >
                  <span className={styles.tabLabelPreview}>
                    {item.label || titleFallback}
                  </span>
                </button>
              ),
            )}
          </div>
          <div ref={panelsRef} className="cr-tabs-panels">
            <NodeViewContent as="div" className={styles.tabsContentHost} />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("tabsBlock", {
    group: "block",
    selectable: true,
    isolating: true,
    content: "tabItem+",
    addAttributes() {
      return { indent: { default: 0 } };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='tabs-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "tabs-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(TabsView);
    },
    addCommands() {
      return {
        setTabsBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}

export function createImageBlockNode(bridgeRef: RichTextEditorBridgeRef) {
  function ImageBlockView(props) {
    useSyncExternalStore(
      bridgeRef.current.subscribeAssetPreview,
      bridgeRef.current.getAssetPreviewVersion,
      bridgeRef.current.getAssetPreviewVersion,
    );
    const attrs = props.node.attrs || {};
    const src = String(attrs.src || "");
    const assetId = src.startsWith("asset://")
      ? src.slice("asset://".length)
      : "";
    const preview = assetId ? bridgeRef.current.resolveAssetUrl(assetId) : src;
    const previewUrl = typeof preview === "string" ? preview : preview?.url;
    const previewMessage =
      typeof preview === "object"
        ? preview.message ||
          (preview.state === "uploading"
            ? bridgeRef.current.translate(
                "editor.assetPreview.uploading",
                "Uploading media...",
              )
            : bridgeRef.current.translate(
                "editor.assetPreview.unavailable",
                "Image preview unavailable",
              ))
        : bridgeRef.current.translate(
            "editor.assetPreview.unavailable",
            "Image preview unavailable",
          );

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          ...buildBlockContextMenuGroups(
            props.editor,
            bridgeRef.current.translate,
          ),
          {
            group: 1,
            children: [
              {
                key: "modify-image",
                label: bridgeRef.current.translate(
                  "editor.context.modify",
                  "Modify",
                ),
                icon: <ImageIcon />,
                onClick: () =>
                  bridgeRef.current.openModal("image", {
                    pos: props.getPos(),
                    ...(attrs || {}),
                  }),
              },
            ],
          },
        ],
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="imageBlock"
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(attrs.indent || 0) * 2}rem` }}
        onContextMenu={handleContextMenu}
      >
        <figure className="cr-image-block">
          {previewUrl ? (
            <>
              <img src={previewUrl} alt={String(attrs.alt || "")} />
              {typeof preview === "object" && preview.state === "uploading" ? (
                <div className={styles.assetStatus}>{previewMessage}</div>
              ) : null}
            </>
          ) : (
            <div className={styles.assetPlaceholder}>{previewMessage}</div>
          )}
        </figure>
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("imageBlock", {
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        src: { default: "" },
        alt: { default: "" },
        title: { default: "" },
        indent: { default: 0 },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='image-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "image-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(ImageBlockView);
    },
    addCommands() {
      return {
        setImageBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}

export function createAnchorBlockNode(bridgeRef: RichTextEditorBridgeRef) {
  function AnchorBlockView(props) {
    const attrs = props.node.attrs || {};
    const anchorId = String(attrs.id || "");

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          ...buildBlockContextMenuGroups(
            props.editor,
            bridgeRef.current.translate,
          ),
        ],
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="anchorBlock"
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(attrs.indent || 0) * 2}rem` }}
        onContextMenu={handleContextMenu}
      >
        <div
          className={styles.anchorBlockPreview}
          id={anchorId}
          data-content-anchor-id={anchorId}
        >
          <span className={styles.anchorBlockLabel}>
            {bridgeRef.current.translate("editor.toolbar.anchor", "Anchor")}
          </span>
          <code className={styles.anchorBlockCode}>#{anchorId}</code>
        </div>
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("anchorBlock", {
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        id: { default: "" },
        indent: { default: 0 },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='anchor-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "anchor-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(AnchorBlockView);
    },
    addCommands() {
      return {
        setAnchorBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}

export function createVideoBlockNode(bridgeRef: RichTextEditorBridgeRef) {
  function VideoBlockView(props) {
    useSyncExternalStore(
      bridgeRef.current.subscribeAssetPreview,
      bridgeRef.current.getAssetPreviewVersion,
      bridgeRef.current.getAssetPreviewVersion,
    );
    const attrs = props.node.attrs || {};
    const src = String(attrs.src || "");
    const assetId = src.startsWith("asset://")
      ? src.slice("asset://".length)
      : "";
    const preview = assetId ? bridgeRef.current.resolveAssetUrl(assetId) : src;
    const previewUrl = typeof preview === "string" ? preview : preview?.url;
    const previewMessage =
      typeof preview === "object"
        ? preview.message ||
          (preview.state === "uploading"
            ? bridgeRef.current.translate(
                "editor.assetPreview.uploading",
                "Uploading media...",
              )
            : bridgeRef.current.translate(
                "editor.assetPreview.unavailable",
                "Video preview unavailable",
              ))
        : bridgeRef.current.translate(
            "editor.assetPreview.unavailable",
            "Video preview unavailable",
          );

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          ...buildBlockContextMenuGroups(
            props.editor,
            bridgeRef.current.translate,
          ),
          {
            group: 1,
            children: [
              {
                key: "modify-video",
                label: bridgeRef.current.translate(
                  "editor.context.modify",
                  "Modify",
                ),
                icon: <VideoIcon />,
                onClick: () =>
                  bridgeRef.current.openModal("video", {
                    pos: props.getPos(),
                    ...(attrs || {}),
                  }),
              },
            ],
          },
        ],
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="videoBlock"
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(attrs.indent || 0) * 2}rem` }}
        onContextMenu={handleContextMenu}
      >
        <figure className="cr-video-block">
          <div className="cr-media-frame">
            {previewUrl ? (
              <>
                <video
                  src={previewUrl}
                  controls
                  onContextMenu={(event) => event.preventDefault()}
                />
                {typeof preview === "object" &&
                preview.state === "uploading" ? (
                  <div className={styles.assetStatus}>{previewMessage}</div>
                ) : null}
              </>
            ) : (
              <div className={styles.assetPlaceholder}>{previewMessage}</div>
            )}
          </div>
        </figure>
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("videoBlock", {
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        src: { default: "" },
        title: { default: "" },
        poster: { default: "" },
        caption: { default: "" },
        indent: { default: 0 },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='video-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "video-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(VideoBlockView);
    },
    addCommands() {
      return {
        setVideoBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}

export function createCustomBlockNode(
  bridgeRef: RichTextEditorBridgeRef,
  customBlockRegistryRef: CustomBlockRegistryRef,
) {
  function CustomBlockView(props) {
    useSyncExternalStore(
      bridgeRef.current.subscribeCustomBlock,
      bridgeRef.current.getCustomBlockVersion,
      bridgeRef.current.getCustomBlockVersion,
    );
    const attrs = props.node.attrs || {};
    const kind = String(attrs.kind || "custom");
    const data = attrs.data && typeof attrs.data === "object" ? attrs.data : {};
    const tool = customBlockRegistryRef.current[kind];
    const Renderer = tool?.customBlock?.render;

    function updateAttrs(nextAttrs) {
      setNodeAttrsAtPos(props.editor, props.getPos(), nextAttrs);
    }

    function updateData(nextData) {
      const resolved =
        typeof nextData === "function" ? nextData(data) : nextData;
      updateAttrs({ data: resolved });
    }

    function buildGroups() {
      const customGroups =
        tool?.customBlock?.getContextMenuGroups?.({
          kind,
          data,
          pos: props.getPos(),
          editor: props.editor,
          translate: bridgeRef.current.translate,
          openModal: bridgeRef.current.openModal,
          updateData,
          updateAttrs,
        }) || [];

      return [
        ...buildBlockContextMenuGroups(
          props.editor,
          bridgeRef.current.translate,
        ),
        ...customGroups,
      ];
    }

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        buildGroups(),
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="customBlock"
        data-editor-custom-kind={kind}
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(attrs.indent || 0) * 2}rem` }}
        onContextMenu={handleContextMenu}
      >
        {Renderer ? (
          <Renderer
            kind={kind}
            data={data}
            selected={props.selected}
            pos={props.getPos()}
            editor={props.editor}
            updateData={updateData}
            updateAttrs={updateAttrs}
          />
        ) : (
          <div className={styles.customBlockFallback}>
            {bridgeRef.current.translate(
              "editor.customBlock.unsupported",
              "Unsupported custom block",
            )}
            : {kind}
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("customBlock", {
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        kind: { default: "custom" },
        data: { default: {} },
        indent: { default: 0 },
      };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='custom-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "custom-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(CustomBlockView);
    },
    addCommands() {
      return {
        setCustomBlock:
          (attrs: Record<string, unknown>) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },
  });
}
