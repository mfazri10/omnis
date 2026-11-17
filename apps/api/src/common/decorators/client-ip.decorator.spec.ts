import { extractClientIp } from "./client-ip.decorator";

describe("extractClientIp", () => {
  it("memakai x-forwarded-for bila ada", () => {
    expect(
      extractClientIp({
        headers: { "x-forwarded-for": "203.0.113.7" },
        ip: "10.0.0.1",
      }),
    ).toBe("203.0.113.7");
  });

  it("mengambil entri pertama x-forwarded-for berantai", () => {
    expect(
      extractClientIp({
        headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
        ip: "10.0.0.1",
      }),
    ).toBe("203.0.113.7");
  });

  it("memangkas spasi nilai mentah", () => {
    expect(
      extractClientIp({
        headers: { "x-forwarded-for": "  203.0.113.7  " },
        ip: "  10.0.0.1 ",
      }),
    ).toBe("203.0.113.7");
  });

  it("mendukung header array ala Express", () => {
    expect(
      extractClientIp({
        headers: { "x-forwarded-for": ["203.0.113.7", "70.41.3.18"] },
      }),
    ).toBe("203.0.113.7");
  });

  it("jatuh ke req.ip bila header tak ada", () => {
    expect(extractClientIp({ headers: {}, ip: "10.0.0.1" })).toBe(
      "10.0.0.1",
    );
  });

  it("jatuh ke req.ip bila header kosong", () => {
    expect(
      extractClientIp({
        headers: { "x-forwarded-for": "   " },
        ip: "10.0.0.1",
      }),
    ).toBe("10.0.0.1");
  });

  it("null bila tidak ada sumber IP yang valid", () => {
    expect(extractClientIp({ headers: {} })).toBeNull();
    expect(extractClientIp({ headers: {}, ip: "   " })).toBeNull();
    expect(extractClientIp({})).toBeNull();
  });

  it("menolak ip bukan string", () => {
    expect(extractClientIp({ headers: {}, ip: 12345 })).toBeNull();
  });
});
