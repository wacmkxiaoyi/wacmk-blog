import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalHost } from "../../hooks/useModalHost";
import styles from "./Modal.module.css";
import "../../theme/variables.css";

const DEFAULT_LABELS = {
  close: "Close",
  cancel: "Cancel",
  confirm: "Confirm",
  loading: "Loading",
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled]):not([tabindex='-1'])",
  "a[href]:not([tabindex='-1'])",
  "input:not([disabled]):not([type='hidden']):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getVisibleActions(actions) {
  return (actions || []).filter((action) => action && action.visible !== false);
}

function getToneIcon(tone) {
  if (tone === "info") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 10v6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M8 12.5l2.5 2.5L16.5 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 4.5L20 18.5H4L12 4.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16.8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M9 9l6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M15 9l-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return null;
}

function findFocusableElements(root) {
  if (!root) {
    return [];
  }
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      return (
        !node.hasAttribute("hidden") &&
        node.getAttribute("aria-hidden") !== "true"
      );
    },
  );
}

function normalizeActionLabel(action, mergedLabels) {
  if (action.label !== undefined && action.label !== null) {
    return action.label;
  }
  if (action.variant === "secondary" || action.variant === "ghost") {
    return mergedLabels.cancel;
  }
  return mergedLabels.confirm;
}

function getLoadingLabel(action, mergedLabels, fallbackLabel) {
  if (action.loadingLabel !== undefined && action.loadingLabel !== null) {
    return action.loadingLabel;
  }
  if (typeof fallbackLabel === "string" && fallbackLabel.trim()) {
    return `${fallbackLabel}...`;
  }
  return `${mergedLabels.loading}...`;
}

function shouldStretchModalContent(size) {
  return ["wide", "table", "attachmentBrowser", "fullscreenEditor"].includes(
    size,
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  kicker,
  tone = "normal",
  size = "sm",
  children,
  actions = [],
  closeOnEsc = true,
  closeOnBackdrop = true,
  showCloseButton = true,
  className,
  labels,
}) {
  const { host, stack, register, unregister } = useModalHost();
  const [modalId, setModalId] = useState(null);
  const [pendingKeys, setPendingKeys] = useState([]);
  const rootRef = useRef(null);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();
  const mergedLabels = { ...DEFAULT_LABELS, ...(labels || {}) };
  const visibleActions = useMemo(
    () =>
      getVisibleActions(actions).map((action) => ({
        ...action,
        label: normalizeActionLabel(action, mergedLabels),
      })),
    [actions, mergedLabels],
  );
  const primaryAction = useMemo(
    () =>
      visibleActions.find((action) => action.variant === "primary") ||
      visibleActions[visibleActions.length - 1] ||
      null,
    [visibleActions],
  );
  const cancelAction = useMemo(
    () =>
      visibleActions.find(
        (action) =>
          action.variant === "secondary" || action.variant === "ghost",
      ) || null,
    [visibleActions],
  );
  const isTopmost =
    modalId != null &&
    stack.length > 0 &&
    stack[stack.length - 1]?.id === modalId;
  const stackIndex =
    modalId != null ? stack.findIndex((entry) => entry.id === modalId) : -1;
  const hasHeader = Boolean(kicker || title || showCloseButton);
  const hasFooter = visibleActions.length > 0;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const id = register({ tone, size });
    setModalId(id);

    return () => {
      unregister(id);
    };
  }, [open, register, unregister, tone, size]);

  useEffect(() => {
    if (!open || !isTopmost) {
      return undefined;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const autoFocusAction = dialog.querySelector(
        "[data-modal-action-autofocus='true']",
      );
      const primaryButton = dialog.querySelector(
        "[data-modal-action-primary='true']",
      );
      const closeButton = dialog.querySelector("[data-modal-close='true']");
      const target =
        autoFocusAction ||
        primaryButton ||
        closeButton ||
        findFocusableElements(dialog)[0] ||
        dialog;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open, isTopmost, modalId]);

  useEffect(() => {
    if (open) {
      return undefined;
    }
    const previous = restoreFocusRef.current;
    if (previous && document.body.contains(previous)) {
      window.requestAnimationFrame(() => {
        previous.focus();
      });
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || !isTopmost) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key === "Tab") {
        const focusable = findFocusableElements(dialogRef.current);
        if (!focusable.length) {
          event.preventDefault();
          if (dialogRef.current) {
            dialogRef.current.focus();
          }
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) {
            event.preventDefault();
            last.focus();
          }
          return;
        }

        if (active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key === "Enter") {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (
          target.closest("button") ||
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        if (!primaryAction) {
          return;
        }
        event.preventDefault();
        const button = dialogRef.current?.querySelector(
          "[data-modal-action-primary='true']",
        );
        if (button instanceof HTMLButtonElement && !button.disabled) {
          button.click();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isTopmost, closeOnEsc, onOpenChange, primaryAction]);

  if (!open || !host || modalId == null) {
    return null;
  }

  const api = {
    close() {
      onOpenChange(false);
    },
  };

  async function runAction(action) {
    if (!action || action.disabled) {
      return;
    }
    const key = action.key;
    setPendingKeys((current) => current.concat(key));
    try {
      const result = action.onClick ? action.onClick(api) : undefined;
      if (result && typeof result.then === "function") {
        await result;
      }
      if (action.keepOpen !== true) {
        onOpenChange(false);
      }
    } finally {
      setPendingKeys((current) => current.filter((item) => item !== key));
    }
  }

  function cancelFromBackdrop() {
    if (
      !isTopmost ||
      !closeOnBackdrop ||
      cancelAction?.disabled ||
      (cancelAction && pendingKeys.includes(cancelAction.key))
    ) {
      return;
    }
    if (cancelAction) {
      void runAction(cancelAction);
      return;
    }
    onOpenChange(false);
  }

  const zIndex = `calc(var(--modal-z-base) + ${Math.max(0, stackIndex)} * var(--modal-z-step))`;
  const toneClassName = tone === "normal" ? "" : styles[`tone-${tone}`];
  const sizeClassName = styles[`size-${size}`] || styles["size-sm"];
  const stretchContent = shouldStretchModalContent(size);
  const icon = getToneIcon(tone);

  return createPortal(
    <div
      ref={rootRef}
      className={[
        styles.frame,
        !isTopmost ? styles.inactive : "",
        toneClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ zIndex }}
      aria-hidden={isTopmost ? "false" : "true"}
      data-modal-stack-index={stackIndex}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          cancelFromBackdrop();
        }
      }}
    >
      <div className={styles.backdrop} onClick={cancelFromBackdrop} />
      <div
        className={styles.shell}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            cancelFromBackdrop();
          }
        }}
      >
        <div
          ref={dialogRef}
          className={[styles.dialog, sizeClassName, className || ""]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
          aria-modal={isTopmost ? "true" : "false"}
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={bodyId}
          tabIndex={-1}
        >
          {hasHeader ? (
            <div className={styles.header}>
              <div className={styles.headerMain}>
                {kicker ? <div className={styles.kicker}>{kicker}</div> : null}
                {title ? (
                  <div className={styles.titleRow}>
                    {icon ? (
                      <span className={styles.toneIcon}>{icon}</span>
                    ) : null}
                    <h2 id={titleId} className={styles.title}>
                      {title}
                    </h2>
                  </div>
                ) : null}
              </div>
              {showCloseButton ? (
                <button
                  type="button"
                  className={styles.closeButton}
                  aria-label={mergedLabels.close}
                  data-modal-close="true"
                  onClick={() => onOpenChange(false)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <div
            id={bodyId}
            className={[styles.body, stretchContent ? styles.bodyStretch : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={[
                styles.content,
                stretchContent ? styles.contentStretch : "",
                size === "fullscreenEditor"
                  ? styles.contentFullscreenEditor
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-modal-content-size={size}
            >
              {children}
            </div>
          </div>
          {hasFooter ? (
            <div className={styles.footer}>
              <div className={styles.footerLeft}>
                {visibleActions
                  .filter(
                    (action) =>
                      action.variant === "secondary" ||
                      action.variant === "ghost",
                  )
                  .map((action) => {
                    const isPending =
                      pendingKeys.includes(action.key) || action.loading;
                    const buttonLabel = isPending
                      ? getLoadingLabel(action, mergedLabels, action.label)
                      : action.label;
                    return (
                      <button
                        key={action.key}
                        type="button"
                        className={[
                          styles.actionButton,
                          styles[`action-${action.variant || "secondary"}`],
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={Boolean(action.disabled || isPending)}
                        aria-busy={isPending ? "true" : undefined}
                        data-modal-action-autofocus={
                          action.autoFocus ? "true" : undefined
                        }
                        onClick={() => void runAction(action)}
                      >
                        {isPending ? (
                          <span
                            className={styles.actionSpinner}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className={styles.actionLabel}>
                          {buttonLabel}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <div className={styles.footerRight}>
                {visibleActions
                  .filter(
                    (action) =>
                      action.variant !== "secondary" &&
                      action.variant !== "ghost",
                  )
                  .map((action) => {
                    const variant = action.variant || "primary";
                    const isPending =
                      pendingKeys.includes(action.key) || action.loading;
                    const buttonLabel = isPending
                      ? getLoadingLabel(action, mergedLabels, action.label)
                      : action.label;
                    return (
                      <button
                        key={action.key}
                        type="button"
                        className={[
                          styles.actionButton,
                          styles[`action-${variant}`],
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={Boolean(action.disabled || isPending)}
                        aria-busy={isPending ? "true" : undefined}
                        data-modal-action-primary={
                          variant === "primary" ? "true" : undefined
                        }
                        data-modal-action-autofocus={
                          action.autoFocus ? "true" : undefined
                        }
                        onClick={() => void runAction(action)}
                      >
                        {isPending ? (
                          <span
                            className={styles.actionSpinner}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className={styles.actionLabel}>
                          {buttonLabel}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    host,
  );
}
