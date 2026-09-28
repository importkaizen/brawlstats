/** Pages are a display limit only; every captured battle remains in storage. */
export function matchHistoryPage(total: number, requestedPage?: string, pageSize = 25) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number(requestedPage ?? 1);
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const offset = (page - 1) * pageSize;
  return { total, page, pageCount, pageSize, offset, from: total ? offset + 1 : 0, to: Math.min(total, offset + pageSize) };
}

export type MatchHistoryPage = ReturnType<typeof matchHistoryPage>;
