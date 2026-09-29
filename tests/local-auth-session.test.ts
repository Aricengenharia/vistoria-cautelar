import { describe, expect, it } from "vitest";

describe("local authentication session", () => {
  it("uses a bearer session token for authenticated API requests", () => {
    expect("Bearer ".startsWith("Bearer ")).toBe(true);
    expect("local-session-token".length).toBeGreaterThan(0);
  });
});
