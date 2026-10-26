import React from "react";
import { EDITOR_COLOR_TOKENS } from "../../../core/constants.ts";
import { translateLabel } from "../../../core/i18n.ts";
import type { EditorTranslate } from "../../../core/types.ts";
import styles from "./EditorInlineToolPanel.module.css";

type InlinePanelState = {
  type: "color" | "table";
  position: { top: number; left: number };
};

type EditorInlineToolPanelProps = {
  inlinePanel: InlinePanelState;
  translate?: EditorTranslate;
  panelRef: React.Ref<HTMLDivElement>;
  onApplyColor: (token: string) => void;
  onApplyTableSize: (rows: number, columns: number) => void;
};

export function EditorInlineToolPanel({
  inlinePanel,
  translate,
  panelRef,
  onApplyColor,
  onApplyTableSize,
}: EditorInlineToolPanelProps) {
  return (
    <div
      ref={panelRef}
      className={styles.inlinePanel}
      style={{ top: inlinePanel.position.top, left: inlinePanel.position.left }}
    >
      {inlinePanel.type === "color" ? (
        <div className={styles.inlineColorGrid}>
          {EDITOR_COLOR_TOKENS.map((option) => (
            <button
              key={option.token}
              type="button"
              className={[
                styles.inlineColorButton,
                styles[
                  `inlineColorButton${option.token[0].toUpperCase()}${option.token.slice(1)}`
                ],
              ].join(" ")}
              onClick={() => onApplyColor(option.token)}
            >
              <span className={styles.inlineColorSwatch} />
              <span>
                {translateLabel(translate, option.labelKey, option.fallback)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {inlinePanel.type === "table" ? (
        <TableSizePicker onSelect={onApplyTableSize} />
      ) : null}
    </div>
  );
}

function TableSizePicker({
  onSelect,
}: {
  onSelect: (rows: number, columns: number) => void;
}) {
  const [hovered, setHovered] = React.useState({ rows: 2, columns: 2 });

  return (
    <div className={styles.tablePicker}>
      <div className={styles.tablePickerLabel}>
        {hovered.rows} x {hovered.columns}
      </div>
      <div className={styles.tablePickerGrid}>
        {Array.from({ length: 10 }).map((_, rowIndex) =>
          Array.from({ length: 10 }).map((__, columnIndex) => {
            const rows = rowIndex + 1;
            const columns = columnIndex + 1;
            const selectable = rows >= 2 && columns >= 2;
            const active =
              selectable && rows <= hovered.rows && columns <= hovered.columns;
            return (
              <button
                key={`${rows}-${columns}`}
                type="button"
                className={[
                  styles.tablePickerCell,
                  active ? styles.tablePickerCellActive : "",
                  !selectable ? styles.tablePickerCellDisabled : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!selectable}
                onMouseEnter={() => selectable && setHovered({ rows, columns })}
                onClick={() => selectable && onSelect(rows, columns)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
