const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Belum tersedia" : dateTimeFormatter.format(date);
}

export function formatCount(value: number | null): string {
  return value === null ? "Belum tersedia" : value.toLocaleString("id-ID");
}
