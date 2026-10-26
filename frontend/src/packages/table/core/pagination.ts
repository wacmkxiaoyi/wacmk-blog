export function getTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  const totalPages = getTotalPages(total, pageSize);
  if (!Number.isFinite(page)) {
    return 1;
  }
  return Math.min(totalPages, Math.max(1, Math.trunc(page)));
}
