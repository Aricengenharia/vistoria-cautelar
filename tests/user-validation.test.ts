import { describe, expect, it } from "vitest";
import { formatUserError, isValidPassword, passwordHint, validateUserForm } from "../lib/user-validation";

describe("user form validation", () => {
  it("requires a password with at least eight characters", () => {
    expect(validateUserForm({ name: "Maria Silva", email: "maria@example.com", password: "1234567" })).toContain("8 caracteres");
    expect(isValidPassword("12345678")).toBe(true);
  });

  it("returns a useful password hint", () => {
    expect(passwordHint("123")).toContain("Faltam 5");
    expect(passwordHint("12345678")).toBe("Senha válida.");
  });

  it("translates server validation errors", () => {
    expect(formatUserError(new Error('password too_small >=8'))).toContain("8 caracteres");
  });
});
