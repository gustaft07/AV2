import type { StatusEquipamento } from "../core/validation";

export const TRANSICOES_STATUS: Record<StatusEquipamento, StatusEquipamento[]> = {
  recebido: ["triagem"],
  triagem: ["triagem_completa"],
  triagem_completa: ["desmonte", "revenda", "descarte_seguro"],
  desmonte: ["reciclagem", "descarte_seguro"],
  reciclagem: [],
  descarte_seguro: [],
  revenda: [],
};
export const STATUS_FINAIS: StatusEquipamento[] = ["reciclagem", "descarte_seguro", "revenda"];

export function transicaoStatusPermitida(de: StatusEquipamento, para: StatusEquipamento): boolean {
  return TRANSICOES_STATUS[de].includes(para);
}
