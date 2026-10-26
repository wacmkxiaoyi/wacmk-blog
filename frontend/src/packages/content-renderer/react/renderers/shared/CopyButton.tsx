import React, { useState } from "react";

export function CopyButton({ value, labels, className = "", onCopy }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    if (!value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setError(false);
      setCopied(true);
      if (typeof onCopy === "function") {
        onCopy();
      }
      window.setTimeout(() => setCopied(false), 1400);
    } catch (_error) {
      setCopied(false);
      setError(true);
      window.setTimeout(() => setError(false), 1400);
    }
  }

  const icon = copied ? "✓" : error ? "×" : "⧉";
  const ariaLabel = copied
    ? labels.copied
    : error
      ? labels.copyFailed || "Copy failed"
      : labels.copy;

  return (
    <button
      type="button"
      className={[
        "cr-copy-button",
        copied ? "is-copied" : "",
        error ? "is-error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
