export default function BalanceIcon({ type, size = 16, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const content =
    type === "money" ? (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
      </>
    ) : (
      <>
        <path d="m12 3 7 6-7 12L5 9Z" />
        <path d="M5 9h14M9 3l3 6 3-6" />
      </>
    );
  return (
    <svg {...common} className={className}>
      {content}
    </svg>
  );
}
