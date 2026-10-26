import React from "react";
import { Tooltip } from "../../packages/tooltip";
import useI18n from "../../hooks/useI18n";
import AccessIcon from "./AccessIcon";
import {
  ACCESS_TYPES,
  getAccessPresentation,
  getValidConditions,
  normalizeAccessType,
} from "./accessPresentation";
import "./AccessTag.css";

function getLabel(presentation, t) {
  const label = t(presentation.labelKey);
  return presentation.value === undefined
    ? label
    : `${label} ${presentation.value}`;
}

function AccessTagContent({ presentation, label, isVIP, iconOnly, summary }) {
  return (
    <span
      className={[
        "access-tag",
        `access-tag--${presentation.tone}`,
        iconOnly && "access-tag--icon-only",
        summary && "access-tag--summary",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isVIP ? (
        <span className="access-tag__vip" aria-hidden="true">
          VIP
        </span>
      ) : null}
      {presentation.icon ? <AccessIcon name={presentation.icon} /> : null}
      {!iconOnly || summary ? (
        <span className="access-tag__label">{label}</span>
      ) : null}
    </span>
  );
}

function TooltipContent({ conditions }) {
  const { t } = useI18n();
  return (
    <div className="access-tag-tooltip__conditions">
      {conditions.map((condition) => (
        <AccessTagContent
          key={condition.type}
          presentation={condition}
          label={getLabel(condition, t)}
        />
      ))}
    </div>
  );
}

export default function AccessTag({
  type,
  value,
  isVIP = false,
  iconOnly = false,
  className = "",
  style,
}) {
  const { t } = useI18n();
  const normalizedType = normalizeAccessType(type);
  const conditions =
    normalizedType === ACCESS_TYPES.CONDITIONAL
      ? getValidConditions(value)
      : [];
  const isSummary =
    normalizedType === ACCESS_TYPES.CONDITIONAL && conditions.length > 1;
  const presentation = isSummary
    ? { tone: "summary", labelKey: "access.conditions.summary" }
    : getAccessPresentation(normalizedType, value);

  if (!presentation) {
    if (import.meta.env.DEV)
      console.warn("AccessTag received an invalid access value.", {
        type,
        value,
      });
    return null;
  }

  const label = isSummary
    ? iconOnly
      ? String(conditions.length)
      : t("access.conditions.summary", { count: conditions.length })
    : getLabel(presentation, t);
  const shouldTooltip = isSummary || iconOnly;
  const content = (
    <AccessTagContent
      presentation={presentation}
      label={label}
      isVIP={isVIP}
      iconOnly={iconOnly}
      summary={isSummary}
    />
  );
  const trigger = (
    <span
      className={["access-tag__trigger", className].filter(Boolean).join(" ")}
      style={style}
      tabIndex={shouldTooltip ? 0 : undefined}
      aria-label={shouldTooltip ? label : undefined}
    >
      {content}
    </span>
  );

  if (!shouldTooltip) return trigger;
  return (
    <Tooltip
      className="access-tag-tooltip-panel"
      backgroundColor="#f7f7f8"
      contentClassName="access-tag-tooltip"
      content={
        isSummary ? (
          <TooltipContent conditions={conditions} />
        ) : (
          <span>{label}</span>
        )
      }
    >
      {trigger}
    </Tooltip>
  );
}
