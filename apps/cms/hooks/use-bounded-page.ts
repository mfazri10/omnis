"use client";

import { useEffect } from "react";

export function useBoundedPage(
  page: number,
  setPage: (page: number) => void,
  pageSize: number,
  totalRows: number | undefined,
): boolean {
  const lastPage = totalRows === undefined ? page : Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);
  return page <= lastPage;
}
