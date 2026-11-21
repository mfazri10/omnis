/** Nilai sel yang didukung serializer CSV ekspor. */
export type CsvCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

const BOM = "﻿";
const CRLF = "\r\n";

/**
 * Sel yang diawali karakter formula (=, +, -, @) diberi prefiks
 * apostrof agar Excel/Sheets tidak mengeksekusinya (CSV injection).
 */
function guardFormula(text: string): string {
  const trimmed = text.trimStart();
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@")
  ) {
    return `'${text}`;
  }
  return text;
}

function cellToText(value: CsvCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Serialisasi satu sel RFC 4180: kutip bila mengandung koma, kutip,
 * atau newline; kutip ganda di-escape jadi dua kutip ganda.
 */
export function serializeCell(value: CsvCellValue): string {
  const text = guardFormula(cellToText(value));
  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function serializeRow(values: CsvCellValue[]): string {
  return values.map(serializeCell).join(",");
}

/**
 * Serialisasi tabel penuh: header + baris, CRLF antar baris, BOM
 * UTF-8 di awal agar Excel membuka berkas dengan encoding benar.
 */
export function serializeCsv(
  header: string[],
  rows: CsvCellValue[][],
): Buffer {
  const lines = [serializeRow(header)];
  for (const row of rows) {
    lines.push(serializeRow(row));
  }
  return Buffer.from(BOM + lines.join(CRLF) + CRLF, "utf8");
}
