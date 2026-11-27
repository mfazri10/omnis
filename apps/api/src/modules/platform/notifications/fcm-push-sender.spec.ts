import { classifyFcmFailure } from "./fcm-push-sender";

describe("classifyFcmFailure", () => {
  it("treats expired registration tokens as invalid", () => {
    expect(classifyFcmFailure({ code: "messaging/registration-token-not-registered" })).toBe("invalid-token");
  });

  it("treats explicit FCM validation errors as rejected", () => {
    expect(classifyFcmFailure({ code: "messaging/invalid-argument" })).toBe("failed");
  });

  it("treats transport failures as ambiguous", () => {
    expect(classifyFcmFailure(new Error("socket timeout"))).toBe("unknown");
  });
});
