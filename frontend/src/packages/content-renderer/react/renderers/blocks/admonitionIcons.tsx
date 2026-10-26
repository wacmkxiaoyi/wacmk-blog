import React from "react";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

function NoteIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v5" />
      <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.8 14.8C7.7 14 7 12.6 7 11a5 5 0 1 1 10 0c0 1.6-.7 3-1.8 3.8-.7.6-1.2 1.3-1.4 2.2h-1.6c-.2-.9-.7-1.6-1.4-2.2Z" />
    </svg>
  );
}

function ImportantIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4.5 7v5c0 4.4 3 7.7 7.5 9 4.5-1.3 7.5-4.6 7.5-9V7L12 3Z" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.3" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CautionIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4.5 20 18.5H4L12 4.5Z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3.8 4.8 8v8L12 20.2 19.2 16V8L12 3.8Z" />
      <path d="M9.4 12h5.2" />
      <path d="M12 9.4v5.2" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  );
}

const iconByVariant = {
  note: NoteIcon,
  tip: TipIcon,
  important: ImportantIcon,
  caution: CautionIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

export function AdmonitionIcon({ variant }) {
  const Icon = iconByVariant[variant] || NoteIcon;
  return <Icon />;
}
