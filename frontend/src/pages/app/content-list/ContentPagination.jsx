import Button from "../../../components/ui/Button";

export default function ContentPagination({
  page,
  totalPages,
  onPageChange,
  t,
}) {
  if (totalPages < 2) return null;
  return (
    <nav
      className="content-list__pagination"
      aria-label={t("contentList.pagination")}
    >
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("table.pagination.previous")}
      </Button>
      <span>
        {t("table.pagination.pageStatus", { current: page, total: totalPages })}
      </span>
      <Button
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t("table.pagination.next")}
      </Button>
    </nav>
  );
}
