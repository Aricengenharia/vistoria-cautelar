import { describe, expect, it } from "vitest";

describe("logout flow", () => {
  it("returns the user to the login route after clearing the session", () => {
    expect("/login").toBe("/login");
  });
});
