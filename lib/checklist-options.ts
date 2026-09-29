export const NO_PATHOLOGY = "Não identificado";

type ChecklistGroups = {
  material: string[];
  pathology: string[];
};

export const EXTERNAL_CHECKLIST: Record<string, ChecklistGroups> = {
  "Portão": { material: ["Ferro", "Alumínio", "Madeira", "Aço", "Não tem"], pathology: ["Oxidado", "Desnivelado", "Danificado", NO_PATHOLOGY] },
  "Piso": { material: ["Cimentado", "Cerâmico", "Paralelepípedo", "Ladrilho", "Vegetação", "Ardósia", "Granito", "Pedra"], pathology: ["Trinca", "Afundamento", "Descolamento", "Umidade", "Estufamento", "Desnivelado", "Quebrado", NO_PATHOLOGY] },
  "Muro de divisa": { material: ["Tijolo chapiscado", "Massa", "Bloco", "Madeira", "Tapume", "Não tem"], pathology: ["Rachadura", "Trinca", "Estufamento", "Umidade", "Descolamento de massa", "Descascamento", NO_PATHOLOGY] },
  "Muro de arrimo": { material: ["Concreto", "Pedra", "Tijolo", "Não tem"], pathology: ["Rachadura", "Trinca", "Tombamento", "Umidade", NO_PATHOLOGY] },
  "Cobertura / telhado": { material: ["Cerâmica", "Metálica", "Fibrocimento", "Laje", "Não tem"], pathology: ["Trinca", "Deslocamento", "Umidade", "Falta de telha", NO_PATHOLOGY] },
  "Vidro": { material: ["Liso", "Fantasia", "Temperado", "Não tem"], pathology: ["Trincado", "Quebrado", NO_PATHOLOGY] },
  "Fachada": { material: ["Massa", "Pedra", "Tijolo aparente", "Azulejado", "Não tem"], pathology: ["Rachadura", "Trinca", "Descolamento de massa", "Umidade", "Descascamento", "Estufamento", NO_PATHOLOGY] },
};

export const INTERNAL_CHECKLIST: Record<string, ChecklistGroups> = {
  "Piso": { material: ["Cerâmico", "Assoalho", "Taco", "Ardósia", "Carpete", "Carp. madeira", "Vinílico", "Granito", "Cimentado"], pathology: ["Trinca", "Afundamento", "Descolamento", "Danificado", "Umidade", NO_PATHOLOGY] },
  "Parede": { material: ["Massa", "Azulejo", "Pastilha", "Quartzo", "Papel de parede", "Divisória", "Textura", "Pintura", "Pedra"], pathology: ["Trinca", "Umidade", "Descolamento", "Danificada", "Fissura", "Estufamento", "Descascamento", NO_PATHOLOGY] },
  "Teto": { material: ["Estuque", "Laje", "Madeira", "Gesso", "PVC"], pathology: ["Trinca", "Umidade", "Descolamento", "Estufamento", "Descascamento", NO_PATHOLOGY] },
  "Caixilho": { material: ["Ferro", "Alumínio", "Madeira", "Aço", "Não tem"], pathology: ["Emperrado", "Oxidado", "Quebrado", "Desnivelado", NO_PATHOLOGY] },
  "Vidro": { material: ["Liso", "Fantasia", "Temperado", "Não tem"], pathology: ["Trincado", "Quebrado", NO_PATHOLOGY] },
  "Porta": { material: ["Massa", "Ferro", "Alumínio", "PVC", "Vidro temperado", "Não tem"], pathology: ["Oxidado", "Desnivelada", "Danificada", "Emperrada", "Trincada", NO_PATHOLOGY] },
};

export function toggleChecklistValue(values: string[], value: string, exclusiveValue?: string): string[] {
  if (!exclusiveValue) {
    return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  }
  if (value === exclusiveValue) {
    return values.includes(value) ? [] : [value];
  }
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values.filter((entry) => entry !== exclusiveValue), value];
}
