import { describe, expect, it, vi } from "vitest";
import { getSessionCookieOptions } from "../server/_core/cookies";

describe("session cookie options", () => {
  it("does not use an internal parent domain in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const options = getSessionCookieOptions({ hostname: "internal.run.app", protocol: "https", headers: {} } as any);
    expect(options.domain).toBeUndefined();
    expect(options.httpOnly).toBe(true);
    vi.unstubAllEnvs();
  });
});
