import React from "react";

export function MediaCard({ title, meta, thumbnail, actions, children }) {
  return (
    <div className="cr-media-card">
      {thumbnail ? (
        <div className="cr-media-card-thumb">{thumbnail}</div>
      ) : null}
      <div className="cr-media-card-body">
        <div className="cr-media-card-title">{title}</div>
        {meta ? <div className="cr-media-card-meta">{meta}</div> : null}
        {children}
        {actions ? (
          <div className="cr-media-card-actions">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
