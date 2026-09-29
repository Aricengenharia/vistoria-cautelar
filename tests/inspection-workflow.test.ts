import { describe, expect, it } from "vitest";
import { canAdvanceInspectionStatus, nextInspectionStatus, stampWorkflowActor, WORKFLOW_STATUSES } from "../shared/inspection-workflow";

describe("inspection workflow", () => {
  it("keeps the four statuses in the required order", () => {
    expect(WORKFLOW_STATUSES).toEqual(["Em elaboração", "Concluído", "Conferido", "Aprovado"]);
    expect(nextInspectionStatus("Em elaboração")).toBe("Concluído");
    expect(nextInspectionStatus("Concluído")).toBe("Conferido");
    expect(nextInspectionStatus("Conferido")).toBe("Aprovado");
    expect(nextInspectionStatus("Aprovado")).toBeNull();
  });

  it("allows only the next step", () => {
    expect(canAdvanceInspectionStatus("Em elaboração", "Concluído")).toBe(true);
    expect(canAdvanceInspectionStatus("Concluído", "Aprovado")).toBe(false);
    expect(canAdvanceInspectionStatus("Conferido", "Aprovado")).toBe(true);
    expect(canAdvanceInspectionStatus("Aprovado", "Aprovado")).toBe(true);
  });

  it("records the responsible actor at each workflow step", () => {
    const completed = stampWorkflowActor({}, "Concluído", "Vistoriador");
    expect(completed.inspectorName).toBe("Vistoriador");
    const reviewed = stampWorkflowActor(completed, "Conferido", "Conferente");
    expect(reviewed.reviewerName).toBe("Conferente");
    const approved = stampWorkflowActor(reviewed, "Aprovado", "Aprovador");
    expect(approved.approverName).toBe("Aprovador");
    expect(stampWorkflowActor({ inspectorName: "Original" }, "Concluído", "Outro").inspectorName).toBe("Original");
  });
});
