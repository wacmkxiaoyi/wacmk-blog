import { useEffect } from "react";
import "./Toast.css";

export default function Toast({
  message,
  type = "error",
  visible,
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (!visible || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, onClose, duration]);

  if (!visible) return null;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <span className="toast__icon">
        {type === "success" ? <CheckIcon /> : <AlertIcon />}
      </span>
      <span className="toast__message">{message}</span>
      {onClose && (
        <button className="toast__close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      )}
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
