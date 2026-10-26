import "./Button.css";

export default function Button({
  children,
  loading,
  fullWidth,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  ...props
}) {
  const className = [
    "btn",
    `btn--${variant}`,
    fullWidth ? "btn--full" : "",
    loading ? "btn--loading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn__spinner" />}
      <span className="btn__label">{children}</span>
    </button>
  );
}
