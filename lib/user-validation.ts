export type UserFormValues = {
  name: string;
  email: string;
  password: string;
};

export const MIN_PASSWORD_LENGTH = 8;

export function validateUserForm(values: UserFormValues): string | null {
  if (values.name.trim().length < 2) return "Informe o nome completo do usuário.";
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) return "Informe um e-mail válido.";
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return "A senha inicial precisa ter no mínimo 8 caracteres.";
  }
  return null;
}

export function passwordHint(password: string): string {
  if (password.length >= MIN_PASSWORD_LENGTH) return "Senha válida.";
  if (!password.length) return "Use pelo menos 8 caracteres.";
  return `Faltam ${MIN_PASSWORD_LENGTH - password.length} caracteres.`;
}

export function formatUserError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("too_small") || message.includes("password") || message.includes(">=8")) {
    return "A senha inicial precisa ter no mínimo 8 caracteres.";
  }
  if (message.toLowerCase().includes("email")) return "Informe um e-mail válido.";
  return message || "Revise os dados e tente novamente.";
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
