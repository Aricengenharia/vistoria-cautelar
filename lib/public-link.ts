export function buildPublicInspectionUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/inspection/public?token=${encodeURIComponent(token)}`;
}

export function isPublicInspectionToken(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
