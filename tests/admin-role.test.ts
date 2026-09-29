import { describe, expect, it } from "vitest";
import { isConfiguredAdminEmail } from "../server/db";

describe("configured administrator", () => {
  it("recognizes the configured email case-insensitively and ignores other emails", () => {
    const configured = new Set(["admin@example.com", "owner@company.test"]);
    expect(isConfiguredAdminEmail("admin@example.com", configured)).toBe(true);
    expect(isConfiguredAdminEmail(" ADMIN@EXAMPLE.COM ", configured)).toBe(true);
    expect(isConfiguredAdminEmail("owner@company.test", configured)).toBe(true);
    expect(isConfiguredAdminEmail(" OWNER@COMPANY.TEST ", configured)).toBe(true);
    expect(isConfiguredAdminEmail("outro@example.com", configured)).toBe(false);
    expect(isConfiguredAdminEmail(undefined, configured)).toBe(false);
  });
});
