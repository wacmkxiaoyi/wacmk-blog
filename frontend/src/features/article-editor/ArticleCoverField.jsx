import { useEffect, useRef, useState } from "react";

export default function ArticleCoverField({
  label,
  replaceLabel,
  removeLabel,
  undoLabel,
  emptyLabel,
  value,
  file,
  remove,
  disabled,
  error,
  onFileChange,
  onRemoveChange,
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const image = preview || (!remove ? value : "");
  return (
    <div className="article-editor__cover-field">
      <span className="article-editor__label">{label}</span>
      <input
        ref={inputRef}
        className="article-editor__file-input"
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0] || null;
          if (selected) {
            onFileChange(selected);
            onRemoveChange(false);
          }
          event.target.value = "";
        }}
      />
      {image ? (
        <img className="article-editor__cover-preview" src={image} alt="" />
      ) : (
        <button
          className="article-editor__cover-empty"
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {emptyLabel}
        </button>
      )}
      <div className="article-editor__cover-actions">
        {image ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {replaceLabel}
          </button>
        ) : null}
        {(image || value) && !remove ? (
          <button
            type="button"
            className="article-editor__danger-button"
            disabled={disabled}
            onClick={() => {
              onFileChange(null);
              onRemoveChange(Boolean(value));
            }}
          >
            {removeLabel}
          </button>
        ) : null}
        {remove ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemoveChange(false)}
          >
            {undoLabel}
          </button>
        ) : null}
      </div>
      {error ? (
        <small className="article-editor__field-error">{error}</small>
      ) : null}
    </div>
  );
}
