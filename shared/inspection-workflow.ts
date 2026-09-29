export const WORKFLOW_STATUSES = [
  "Em elaboração",
  "Concluído",
  "Conferido",
  "Aprovado",
] as const;

export type InspectionStatus = (typeof WORKFLOW_STATUSES)[number];

export function nextInspectionStatus(status: InspectionStatus): InspectionStatus | null {
  const index = WORKFLOW_STATUSES.indexOf(status);
  return index >= 0 && index < WORKFLOW_STATUSES.length - 1 ? WORKFLOW_STATUSES[index + 1] : null;
}

export function canAdvanceInspectionStatus(current: InspectionStatus, next: InspectionStatus): boolean {
  return current === next || nextInspectionStatus(current) === next;
}

export function workflowStatusLabel(status: InspectionStatus): string {
  return status === "Em elaboração" ? "Em elaboração" : status;
}

export function stampWorkflowActor(payload: Record<string, unknown>, status: InspectionStatus, actorName: string): Record<string, unknown> {
  const next = { ...payload };
  if (status === "Concluído" && !(typeof next.inspectorName === "string" && next.inspectorName.trim())) next.inspectorName = actorName;
  if (status === "Conferido") next.reviewerName = actorName;
  if (status === "Aprovado") next.approverName = actorName;
  return next;
}
