import React from "react";

function createIcon(path: React.ReactNode, viewBox = "0 0 24 24") {
  return function Icon() {
    return (
      <svg viewBox={viewBox} aria-hidden="true" focusable="false">
        {path}
      </svg>
    );
  };
}

export const ParagraphIcon = createIcon(
  <path
    d="M6 7h12M12 7v10"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    fill="none"
  />,
);
export const NavigationIcon = createIcon(
  <>
    <circle cx="5.5" cy="7" r="1.2" fill="currentColor" />
    <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="5.5" cy="17" r="1.2" fill="currentColor" />
    <path
      d="M9 7h10M11 12h8M13 17h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const Heading1Icon = createIcon(
  <>
    <path
      d="M5 6v12M11 6v12M5 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M17 9l2-2v10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const Heading2Icon = createIcon(
  <>
    <path
      d="M5 6v12M11 6v12M5 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M16.5 9.5a2.5 2.5 0 1 1 5 0c0 1.3-.8 2.2-1.7 3L17 15.5h4.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const Heading3Icon = createIcon(
  <>
    <path
      d="M5 6v12M11 6v12M5 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M17 9.5h3.5l-2 2a2.2 2.2 0 1 1 0 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const Heading4Icon = createIcon(
  <>
    <path
      d="M5 6v12M11 6v12M5 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M19 8v8M16 13h6M16 13l3-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const Heading5Icon = createIcon(
  <>
    <path
      d="M5 6v12M11 6v12M5 12h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M21 8h-4l-.5 4.2a3 3 0 1 1 .8 5.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const BoldIcon = createIcon(
  <path
    d="M8 6h5a3 3 0 1 1 0 6H8zm0 6h6a3 3 0 1 1 0 6H8z"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const ItalicIcon = createIcon(
  <path
    d="M14 6h-4M14 18h-4M13 6l-2 12"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    fill="none"
  />,
);
export const StrikeIcon = createIcon(
  <>
    <path
      d="M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M9 7.5c.5-.9 1.6-1.5 3-1.5 2 0 3.5 1 3.5 2.5 0 3-7 1.5-7 5 0 1.6 1.6 2.5 3.5 2.5 1.6 0 2.9-.6 3.5-1.7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const UnderlineIcon = createIcon(
  <>
    <path
      d="M8 6v5a4 4 0 0 0 8 0V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M6 18h12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const ColorIcon = createIcon(
  <>
    <path
      d="M8 16h8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="m12 6 4 10M12 6 8 16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M7 19h10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const BulletListIcon = createIcon(
  <>
    <circle cx="6" cy="7" r="1.3" fill="currentColor" />
    <circle cx="6" cy="12" r="1.3" fill="currentColor" />
    <circle cx="6" cy="17" r="1.3" fill="currentColor" />
    <path
      d="M10 7h8M10 12h8M10 17h8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const OrderedListIcon = createIcon(
  <>
    <path
      d="M4 7h1.5V5.8L4.5 6.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M4 12h1.5c0-1 1-1.2 1-2S5.8 9 5 9c-.5 0-.9.2-1.2.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M4 17c.3.4.8.7 1.5.7 1 0 1.7-.5 1.7-1.3S6.4 15 5.5 15H4.8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 7h10M10 12h10M10 17h10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const HorizontalRuleIcon = createIcon(
  <>
    <path
      d="M4 12h16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="8" cy="12" r="1.4" fill="currentColor" />
    <circle cx="16" cy="12" r="1.4" fill="currentColor" />
  </>,
);
export const AnchorIcon = createIcon(
  <>
    <circle cx="12" cy="7" r="2" fill="currentColor" />
    <path
      d="M12 9v9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M7 12h10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M7 18c1.8-1.8 3-2.7 5-2.7s3.2.9 5 2.7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </>,
);
export const CheckboxListIcon = createIcon(
  <>
    <rect
      x="4"
      y="5"
      width="3"
      height="3"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    <path
      d="M10 6.5h10M10 12h10M10 17.5h10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <rect
      x="4"
      y="10.5"
      width="3"
      height="3"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    <path
      d="m4.8 12 1 1 1.7-2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <rect
      x="4"
      y="16"
      width="3"
      height="3"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
  </>,
);
export const InlineCodeIcon = createIcon(
  <path
    d="m9 8-4 4 4 4M15 8l4 4-4 4"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const CodeBlockIcon = createIcon(
  <>
    <path
      d="m8 8-4 4 4 4M16 8l4 4-4 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="m11 19 2-14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </>,
);
export const InlineMathIcon = createIcon(
  <path
    d="M6 8 3.5 12 6 16M18 8l2.5 4-2.5 4M8 12h8M12 8v8"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const MathBlockIcon = createIcon(
  <>
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <path
      d="M8 10h8M8 14h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </>,
);
export const QuoteIcon = createIcon(
  <>
    <path
      d="M7 10h4v5H6v-3a4 4 0 0 1 4-4M17 10h4v5h-5v-3a4 4 0 0 1 4-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const AdmonitionIcon = createIcon(
  <>
    <path
      d="M12 4.5 20 18.5H4L12 4.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M12 9v4.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" />
  </>,
);
export const TabsIcon = createIcon(
  <>
    <rect
      x="4"
      y="6"
      width="6"
      height="3"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    <rect
      x="11"
      y="6"
      width="4"
      height="3"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    <rect
      x="16"
      y="6"
      width="4"
      height="3"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
    <path d="M4 10h16v8H4z" stroke="currentColor" strokeWidth="2" fill="none" />
  </>,
);
export const TableIcon = createIcon(
  <>
    <rect
      x="4"
      y="5"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <path d="M4 10h16M9 5v14M15 5v14" stroke="currentColor" strokeWidth="2" />
  </>,
);
export const LinkIcon = createIcon(
  <>
    <path
      d="M10 14 8.5 15.5a3 3 0 0 1-4.2-4.2L7 8.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M14 10 15.5 8.5a3 3 0 0 1 4.2 4.2L17 15.4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M8 12h8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </>,
);
export const ImageIcon = createIcon(
  <>
    <rect
      x="4"
      y="5"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <path
      d="m7 17 4-4 3 3 2-2 3 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const VideoIcon = createIcon(
  <>
    <rect
      x="4"
      y="6"
      width="12"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <path d="m11 10 4 2-4 2z" fill="currentColor" />
    <path
      d="m16 11 4-2v6l-4-2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const HtmlIcon = createIcon(
  <>
    <rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    <path
      d="m9 9-3 3 3 3M15 9l3 3-3 3M11.5 16l1.5-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const MarkdownIcon = createIcon(
  <path
    d="M4 6h16v12H4zM7.5 15V9l2.5 3 2.5-3v6M14.5 15V9l2.5 3 2.5-3"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const FullscreenIcon = createIcon(
  <>
    <path
      d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M9 9 4 4M15 9l5-5M15 15l5 5M9 15l-5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const ChevronDownIcon = createIcon(
  <path
    d="m7 10 5 5 5-5"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const ChevronRightIcon = createIcon(
  <path
    d="m10 7 5 5-5 5"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
export const AddIcon = createIcon(
  <path
    d="M12 5v14M5 12h14"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />,
);
export const DeleteIcon = createIcon(
  <>
    <path
      d="M5 7h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M9 7V5h6v2M8 7l1 11h6l1-11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>,
);
export const EditIcon = createIcon(
  <path
    d="m5 19 4-.8L19 8.2 15.8 5 5.8 15zM14.5 6.3 17.7 9.5"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />,
);
