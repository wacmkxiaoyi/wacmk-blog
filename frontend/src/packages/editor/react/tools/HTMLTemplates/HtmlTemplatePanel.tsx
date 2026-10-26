import React from "react";
import type { EditorTranslate } from "../../../core/types.ts";
import { HTML_TEMPLATES, type HtmlTemplate } from "./htmlTemplates.ts";

type HtmlTemplatePanelProps = {
  translate: EditorTranslate;
  selectedTemplateId: string | null;
  onSelect: (template: HtmlTemplate) => void;
  styles: Record<string, string>;
};

function TemplateThumbnail({
  template,
  styles,
}: {
  template: HtmlTemplate;
  styles: Record<string, string>;
}) {
  return (
    <span
      className={[
        styles.htmlTemplateThumbnail,
        styles[
          `htmlTemplateThumbnail${template.preview.replace(/(^|-)\w/g, (part) => part.replace("-", "").toUpperCase())}`
        ],
      ].join(" ")}
      aria-hidden="true"
    >
      <span className={styles.htmlTemplateThumbnailAccent} />
      <span className={styles.htmlTemplateThumbnailTitle} />
      <span className={styles.htmlTemplateThumbnailCopy} />
      <span
        className={[
          styles.htmlTemplateThumbnailCopy,
          styles.htmlTemplateThumbnailCopyShort,
        ].join(" ")}
      />
      <span
        className={[
          styles.htmlTemplateThumbnailBlock,
          styles.htmlTemplateThumbnailBlockFirst,
        ].join(" ")}
      />
      <span
        className={[
          styles.htmlTemplateThumbnailBlock,
          styles.htmlTemplateThumbnailBlockSecond,
        ].join(" ")}
      />
      <span
        className={[
          styles.htmlTemplateThumbnailBlock,
          styles.htmlTemplateThumbnailBlockThird,
        ].join(" ")}
      />
    </span>
  );
}

export function HtmlTemplatePanel({
  translate,
  selectedTemplateId,
  onSelect,
  styles,
}: HtmlTemplatePanelProps) {
  return (
    <aside
      className={styles.htmlTemplatePanel}
      aria-label={translate("editor.field.templates", "Templates")}
    >
      <span className={styles.modalLabel}>
        {translate("editor.field.templates", "Templates")}
      </span>
      <p className={styles.htmlTemplateHelp}>
        {translate(
          "editor.htmlTemplate.help",
          "Choose a layout to replace the HTML code.",
        )}
      </p>
      <div className={styles.htmlTemplateList}>
        {HTML_TEMPLATES.map((template) => {
          const name = translate(template.nameKey, template.nameFallback);
          const description = translate(
            template.descriptionKey,
            template.descriptionFallback,
          );
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              className={[
                styles.htmlTemplateButton,
                isSelected ? styles.htmlTemplateButtonSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={isSelected}
              onClick={() => onSelect(template)}
            >
              <TemplateThumbnail template={template} styles={styles} />
              <span className={styles.htmlTemplateText}>
                <span className={styles.htmlTemplateName}>{name}</span>
                <span className={styles.htmlTemplateDescription}>
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
