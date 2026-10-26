import { useId } from "react";
import "./Checkbox.css";

export default function Checkbox({ label, id, ...props }) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <label className="checkbox-label" htmlFor={checkboxId}>
      <input
        id={checkboxId}
        className="checkbox-input"
        type="checkbox"
        {...props}
      />
      <span className="checkbox-mark" />
      {label && <span className="checkbox-text">{label}</span>}
    </label>
  );
}
