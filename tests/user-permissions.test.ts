import { describe, expect, it } from "vitest";
import { FULL_PERMISSIONS, INSPECTOR_PERMISSIONS, resolveUserPermissions } from "../server/db";

describe("user permissions", () => {
  it("gives administrators all permissions", () => {
    expect(resolveUserPermissions({ role: "admin", permissions: null })).toEqual(FULL_PERMISSIONS);
    expect(FULL_PERMISSIONS.reviewInspections).toBe(true);
    expect(FULL_PERMISSIONS.approveInspections).toBe(true);
  });
  it("uses safe inspector defaults and accepts individual releases", () => {
    expect(resolveUserPermissions({ role: "user", permissions: null })).toEqual(INSPECTOR_PERMISSIONS);
    expect(INSPECTOR_PERMISSIONS.reviewInspections).toBe(false);
    expect(INSPECTOR_PERMISSIONS.approveInspections).toBe(false);
    expect(resolveUserPermissions({ role: "user", permissions: { ...INSPECTOR_PERMISSIONS, viewAllInspections: true } }).viewAllInspections).toBe(true);
  });
});
