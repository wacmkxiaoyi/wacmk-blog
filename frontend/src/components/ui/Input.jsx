import "./Input.css";

export default function Input({ label, error, id, type = "text", ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="field-group">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input-control${error ? " input-control--error" : ""}`}
        type={type}
        {...props}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
