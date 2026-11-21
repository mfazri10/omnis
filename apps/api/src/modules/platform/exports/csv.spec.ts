import { serializeCell, serializeCsv, serializeRow } from "./csv";

describe("serializeCell", () => {
  it("membiarkan teks polos tanpa kutip", () => {
    expect(serializeCell("budi")).toBe("budi");
  });

  it("mengutip sel berkoma", () => {
    expect(serializeCell("Santoso, Budi")).toBe('"Santoso, Budi"');
  });

  it("mengutip sel ber-newline", () => {
    expect(serializeCell("baris satu\nbaris dua")).toBe(
      '"baris satu\nbaris dua"',
    );
  });

  it("meng-escape kutip ganda jadi dua kutip", () => {
    expect(serializeCell('kata "penting"')).toBe('"kata ""penting"""');
  });

  it("null dan undefined menjadi sel kosong", () => {
    expect(serializeCell(null)).toBe("");
    expect(serializeCell(undefined)).toBe("");
  });

  it("tanggal menjadi ISO 8601", () => {
    expect(serializeCell(new Date("2026-11-21T10:00:00.000Z"))).toBe(
      "2026-11-21T10:00:00.000Z",
    );
  });

  it("boolean menjadi true/false", () => {
    expect(serializeCell(true)).toBe("true");
    expect(serializeCell(false)).toBe("false");
  });

  it.each([["=1+1"], ["+62"], ["-5"], ["@nama"]])(
    "memberi prefiks apostrof pada %p (proteksi injection)",
    (value: string) => {
      expect(serializeCell(value)).toBe(`'${value}`);
    },
  );

  it("proteksi injection mengabaikan whitespace depan", () => {
    expect(serializeCell("  =1+1")).toBe("'  =1+1");
  });

  it("tidak memberi apostrof pada teks biasa", () => {
    expect(serializeCell("nama pengguna")).toBe("nama pengguna");
  });
});

describe("serializeRow", () => {
  it("menggabung sel dengan koma", () => {
    expect(serializeRow(["a", "b,c", 1])).toBe('a,"b,c",1');
  });
});

describe("serializeCsv", () => {
  it("memakai CRLF antar baris dan BOM di awal", () => {
    const buffer = serializeCsv(["id", "name"], [["1", "budi"]]);
    const text = buffer.toString("utf8");
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toBe("﻿id,name\r\n1,budi\r\n");
  });

  it("header saja tetap diakhiri CRLF", () => {
    expect(serializeCsv(["id"], []).toString("utf8")).toBe("﻿id\r\n");
  });
});
