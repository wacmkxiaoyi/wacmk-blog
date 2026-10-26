import React from "react";
import { getHtmlFrameContentHeight } from "../../utils/htmlFrameHeight.ts";

function HtmlBlockFrame({ html }) {
  const frameRef = React.useRef(null);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    let resizeObserver = null;

    function updateHeight() {
      const doc = frame.contentDocument;
      if (!doc) {
        return;
      }
      const nextHeight = getHtmlFrameContentHeight(doc);
      frame.style.height = `${nextHeight}px`;
    }

    function attachObserver() {
      const doc = frame.contentDocument;
      if (!doc) {
        return;
      }
      updateHeight();
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => updateHeight());
        if (doc.documentElement) resizeObserver.observe(doc.documentElement);
        if (doc.body) resizeObserver.observe(doc.body);
      }
    }

    frame.addEventListener("load", attachObserver);
    attachObserver();
    return () => {
      frame.removeEventListener("load", attachObserver);
      resizeObserver?.disconnect?.();
    };
  }, [html]);

  return (
    <iframe
      ref={frameRef}
      title="HTML block"
      className="cr-html-block-frame"
      sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html}
    />
  );
}

export function CustomRenderer({ node, context }) {
  if (node.kind === "html") {
    return (
      <div className="cr-html-block" data-custom-kind="html">
        <HtmlBlockFrame
          html={String(
            node.data?.html || "<!doctype html><html><body></body></html>",
          )}
        />
      </div>
    );
  }

  const resolvedComponent =
    typeof context.resolveCustomComponent === "function"
      ? context.resolveCustomComponent(node, context)
      : null;
  const RegistryComponent = context.customComponents?.[node.kind];
  const Component = resolvedComponent || RegistryComponent;

  if (Component) {
    return <Component node={node} context={context} />;
  }

  return (
    <div className="cr-custom-fallback" data-custom-kind={node.kind}>
      Unsupported custom block: {node.kind}
    </div>
  );
}
