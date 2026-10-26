import { getArticleTagPalette } from "./articleTagPalette";
import "./ArticleTag.css";

export default function ArticleTag({
  tag,
  onClick,
  disabled = false,
  showHash = true,
  className = "",
  ...props
}) {
  const name = tag?.name || "";
  const classes = [
    "article-tag",
    onClick && "article-tag--interactive",
    disabled && "article-tag--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {showHash ? <span aria-hidden="true">#</span> : null}
      {name}
    </>
  );
  const handleClick = (event) => onClick?.(event, tag);
  const style = { ...getArticleTagPalette(tag), ...props.style };

  if (onClick)
    return (
      <button
        {...props}
        type="button"
        className={classes}
        style={style}
        onClick={handleClick}
        disabled={disabled}
      >
        {content}
      </button>
    );
  return (
    <span
      {...props}
      className={classes}
      style={style}
      aria-disabled={disabled || undefined}
    >
      {content}
    </span>
  );
}
