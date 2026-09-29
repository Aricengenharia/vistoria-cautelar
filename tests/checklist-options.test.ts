import { describe, expect, it } from "vitest";
import { EXTERNAL_CHECKLIST, INTERNAL_CHECKLIST, NO_PATHOLOGY, toggleChecklistValue } from "../lib/checklist-options";

describe("opção de patologia não identificada", () => {
  it("aparece em todos os elementos externos e internos", () => {
    expect(Object.values(EXTERNAL_CHECKLIST).every((groups) => groups.pathology.includes(NO_PATHOLOGY))).toBe(true);
    expect(Object.values(INTERNAL_CHECKLIST).every((groups) => groups.pathology.includes(NO_PATHOLOGY))).toBe(true);
  });

  it("torna Não identificado exclusivo das outras patologias", () => {
    expect(toggleChecklistValue(["Trinca"], NO_PATHOLOGY, NO_PATHOLOGY)).toEqual([NO_PATHOLOGY]);
    expect(toggleChecklistValue([NO_PATHOLOGY], "Umidade", NO_PATHOLOGY)).toEqual(["Umidade"]);
    expect(toggleChecklistValue([NO_PATHOLOGY], NO_PATHOLOGY, NO_PATHOLOGY)).toEqual([]);
  });

  it("mantém a seleção múltipla para patologias específicas", () => {
    expect(toggleChecklistValue(["Trinca"], "Umidade", NO_PATHOLOGY)).toEqual(["Trinca", "Umidade"]);
    expect(toggleChecklistValue(["Trinca", "Umidade"], "Trinca", NO_PATHOLOGY)).toEqual(["Umidade"]);
  });
});
