import React from "react";
import { renderInlineChildren } from "../../utils";
import { MediaFrame } from "../shared/MediaFrame";

export function VideoRenderer({ node, context }) {
  const resolved =
    typeof context.resolvers.video === "function"
      ? { ...node, ...(context.resolvers.video(node, context) || {}) }
      : node;

  return (
    <figure className="cr-video-block">
      <MediaFrame>
        <video
          src={resolved.src}
          title={resolved.title}
          poster={resolved.poster}
          controls={resolved.controls !== false}
          muted={resolved.muted}
          loop={resolved.loop}
          autoPlay={Boolean(resolved.autoplay && resolved.muted)}
          width={resolved.width}
          height={resolved.height}
        />
      </MediaFrame>
      {resolved.caption?.length ? (
        <figcaption>
          {renderInlineChildren(resolved.caption, context)}
        </figcaption>
      ) : null}
    </figure>
  );
}
