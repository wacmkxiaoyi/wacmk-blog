import React from "react";
import Input from "../../../../../components/ui/Input.jsx";
import { Modal } from "../../../../modal/index.ts";
import type { EditorTranslate } from "../../../core/types.ts";
import {
  HtmlTemplatePanel,
  type HtmlTemplate,
} from "../../tools/HTMLTemplates/index.ts";
import { getHtmlFrameContentHeight } from "../../../../content-renderer/react/utils/htmlFrameHeight.ts";
import type {
  EditorModalFormState,
  EditorTypedModalState,
} from "./helpers/types.ts";
import styles from "./RichTextEditor.module.css";

function HtmlPreviewFrame({ html, title }: { html: string; title: string }) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

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
      resizeObserver?.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      className={styles.htmlPreviewFrame}
      sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={html || "<!doctype html><html><body></body></html>"}
    />
  );
}

function resolveInitialCurrentArticleModalState(
  modalState: EditorTypedModalState,
): Pick<EditorModalFormState, "linkType" | "targetId"> {
  const headingOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.headingOptions || []
      : [];
  const formulaOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.formulaOptions || []
      : [];
  const anchorOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.anchorOptions || []
      : [];
  const requestedLinkType =
    modalState.type === "link-current-article"
      ? modalState.payload?.linkType
      : "section";
  const linkType =
    requestedLinkType === "formula"
      ? formulaOptions.length
        ? "formula"
        : "section"
      : requestedLinkType === "anchor"
        ? anchorOptions.length
          ? "anchor"
          : headingOptions.length
            ? "section"
            : formulaOptions.length
              ? "formula"
              : "section"
        : headingOptions.length
          ? "section"
          : formulaOptions.length
            ? "formula"
            : "section";
  const targetId =
    modalState.type === "link-current-article"
      ? String(
          modalState.payload?.targetId ||
            (linkType === "formula"
              ? formulaOptions[0]?.id
              : linkType === "anchor"
                ? anchorOptions[0]?.id
                : headingOptions[0]?.id) ||
            "",
        )
      : "";

  return { linkType, targetId };
}

type EditorModalContentProps = {
  modalState: EditorTypedModalState;
  translate: EditorTranslate;
  stateRef: React.MutableRefObject<EditorModalFormState>;
};

function ModalTextarea({
  label,
  value,
  onChange,
  rows = 8,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  rows?: number;
}) {
  return (
    <label className={styles.modalField}>
      <span className={styles.modalLabel}>{label}</span>
      <textarea
        className={styles.modalTextarea}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function EditorModalContent({
  modalState,
  translate,
  stateRef,
}: EditorModalContentProps) {
  const initialCurrentArticleState =
    resolveInitialCurrentArticleModalState(modalState);
  const [state, setState] = React.useState<EditorModalFormState>(() => ({
    label: String(modalState.payload?.label || modalState.payload?.alt || ""),
    url: String(
      modalState.payload?.url ||
        modalState.payload?.href ||
        modalState.payload?.src ||
        "",
    ),
    formula: String(modalState.payload?.value || ""),
    html: String(modalState.payload?.html || ""),
    anchorName: String(modalState.payload?.id || ""),
    linkType: initialCurrentArticleState.linkType,
    targetId: initialCurrentArticleState.targetId,
  }));
  const [pendingTemplate, setPendingTemplate] =
    React.useState<HtmlTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    string | null
  >(null);

  function patch(next: Partial<EditorModalFormState>) {
    setState((current) => ({ ...current, ...next }));
  }

  React.useEffect(() => {
    const nextCurrentArticleState =
      resolveInitialCurrentArticleModalState(modalState);
    setState({
      label: String(modalState.payload?.label || modalState.payload?.alt || ""),
      url: String(
        modalState.payload?.url ||
          modalState.payload?.href ||
          modalState.payload?.src ||
          "",
      ),
      formula: String(modalState.payload?.value || ""),
      html: String(modalState.payload?.html || ""),
      anchorName: String(modalState.payload?.id || ""),
      linkType: nextCurrentArticleState.linkType,
      targetId: nextCurrentArticleState.targetId,
    });
    setPendingTemplate(null);
    setSelectedTemplateId(null);
  }, [modalState]);

  const headingOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.headingOptions || []
      : [];
  const formulaOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.formulaOptions || []
      : [];
  const anchorOptions =
    modalState.type === "link-current-article"
      ? modalState.payload?.anchorOptions || []
      : [];
  const currentTargetOptions =
    state.linkType === "formula"
      ? formulaOptions
      : state.linkType === "anchor"
        ? anchorOptions
        : headingOptions;

  React.useEffect(() => {
    if (modalState.type !== "link-current-article") {
      return;
    }

    const nextOptions =
      state.linkType === "formula"
        ? formulaOptions
        : state.linkType === "anchor"
          ? anchorOptions
          : headingOptions;
    const hasCurrentTarget = nextOptions.some(
      (item) => item.id === state.targetId,
    );
    if (hasCurrentTarget) {
      return;
    }

    const nextTargetId = nextOptions[0]?.id || "";
    if (nextTargetId !== state.targetId) {
      setState((current) => ({ ...current, targetId: nextTargetId }));
    }
  }, [
    modalState.type,
    state.linkType,
    state.targetId,
    headingOptions,
    formulaOptions,
    anchorOptions,
  ]);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state, stateRef]);

  function applyTemplate(template: HtmlTemplate) {
    patch({ html: template.html });
    setSelectedTemplateId(template.id);
    setPendingTemplate(null);
  }

  function selectTemplate(template: HtmlTemplate) {
    if (state.html.trim()) {
      setPendingTemplate(template);
      return;
    }
    applyTemplate(template);
  }

  return (
    <div className={styles.modalBody}>
      {modalState.type === "link" ? (
        <>
          <Input
            label={translate("editor.field.displayName", "Display name")}
            value={state.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
          <Input
            label={translate("editor.field.url", "URL")}
            value={state.url}
            onChange={(event) => patch({ url: event.target.value })}
          />
        </>
      ) : null}

      {modalState.type === "link-current-article" ? (
        <>
          <Input
            label={translate("editor.field.displayName", "Display name")}
            value={state.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
          <label className={styles.modalField}>
            <span className={styles.modalLabel}>
              {translate("editor.field.type", "Type")}
            </span>
            <select
              className={styles.modalSelect}
              value={state.linkType}
              onChange={(event) =>
                patch({
                  linkType: event.target.value as
                    "section" | "formula" | "anchor",
                })
              }
            >
              <option value="section">
                {translate("editor.field.section", "Section")}
              </option>
              <option value="formula">
                {translate("editor.field.formulaTarget", "Formula")}
              </option>
              <option value="anchor">
                {translate("editor.field.anchorTarget", "Anchor")}
              </option>
            </select>
          </label>
          <label className={styles.modalField}>
            <span className={styles.modalLabel}>
              {translate("editor.field.to", "To")}
            </span>
            <select
              className={styles.modalSelect}
              value={state.targetId}
              onChange={(event) => patch({ targetId: event.target.value })}
              disabled={!currentTargetOptions.length}
            >
              {currentTargetOptions.length ? (
                currentTargetOptions.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.text}
                  </option>
                ))
              ) : (
                <option value="">
                  {translate("editor.field.noTargets", "No targets available")}
                </option>
              )}
            </select>
          </label>
        </>
      ) : null}

      {modalState.type === "anchor" ? (
        <Input
          label={translate("editor.field.anchorName", "Anchor name")}
          value={state.anchorName}
          onChange={(event) => patch({ anchorName: event.target.value })}
        />
      ) : null}

      {modalState.type === "image" ? (
        <>
          <Input
            label={translate("editor.field.displayName", "Display name")}
            value={state.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
          <Input
            label={translate("editor.field.url", "URL")}
            value={state.url}
            onChange={(event) => patch({ url: event.target.value })}
          />
        </>
      ) : null}

      {modalState.type === "video" ? (
        <>
          <Input
            label={translate("editor.field.displayName", "Display name")}
            value={state.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
          <Input
            label={translate("editor.field.url", "URL")}
            value={state.url}
            onChange={(event) => patch({ url: event.target.value })}
          />
        </>
      ) : null}

      {modalState.type === "html" ? (
        <div className={styles.htmlModalLayout}>
          <div className={styles.htmlContentPanel}>
            <ModalTextarea
              label={translate("editor.field.html", "HTML")}
              value={state.html}
              onChange={(html) => {
                patch({ html });
                setSelectedTemplateId(null);
              }}
              rows={12}
            />
            <div className={styles.htmlPreviewPanel}>
              <span className={styles.modalLabel}>
                {translate("editor.field.preview", "Preview")}
              </span>
              <HtmlPreviewFrame
                html={state.html}
                title={translate("editor.field.preview", "Preview")}
              />
            </div>
          </div>
          <HtmlTemplatePanel
            translate={translate}
            selectedTemplateId={selectedTemplateId}
            onSelect={selectTemplate}
            styles={styles}
          />
        </div>
      ) : null}

      <Modal
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
        title={translate(
          "editor.htmlTemplate.replaceTitle",
          "Replace HTML with template?",
        )}
        tone="warning"
        labels={{
          cancel: translate("editor.modal.cancel", "Cancel"),
          confirm: translate("editor.htmlTemplate.replace", "Replace HTML"),
          close: translate("editor.modal.close", "Close"),
        }}
        actions={[
          {
            key: "cancel-template-replacement",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "confirm-template-replacement",
            variant: "primary",
            onClick: () => {
              if (pendingTemplate) applyTemplate(pendingTemplate);
            },
          },
        ]}
      >
        <p>
          {translate(
            "editor.htmlTemplate.replaceWarning",
            "Choosing a template will replace the current HTML code. This cannot be undone.",
          )}
        </p>
      </Modal>

      {modalState.type === "inline-math" || modalState.type === "math-block" ? (
        <ModalTextarea
          label={translate("editor.field.formula", "Formula")}
          value={state.formula}
          onChange={(formula) => patch({ formula })}
          rows={modalState.type === "inline-math" ? 4 : 8}
        />
      ) : null}
    </div>
  );
}
