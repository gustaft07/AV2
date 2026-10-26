import type { StatusEquipamento } from "../core/validation";

/**
 * ATENÇÃO: a AV1 só impõe uma regra de status: "desmonte" exige "triagem_completa"
 * (validarTransicaoParaDesmonte). O mapa abaixo estende essa regra a um fluxo linear
 * plausível para a API. Ajuste livremente conforme o seu CLI.
 */
export const TRANSICOES_STATUS: Record<StatusEquipamento, StatusEquipamento[]> = {
  recebido: ["triagem"],
  triagem: ["triagem_completa"],
  triagem_completa: ["desmonte", "revenda", "descarte_seguro"],
  desmonte: ["reciclagem", "descarte_seguro"],
  reciclagem: [],
  descarte_seguro: [],
  revenda: [],
};

/** Destinações finais: o equipamento sai do fluxo. */
export const STATUS_FINAIS: StatusEquipamento[] = ["reciclagem", "descarte_seguro", "revenda"];

export function transicaoStatusPermitida(de: StatusEquipamento, para: StatusEquipamento): boolean {
  return TRANSICOES_STATUS[de].includes(para);
}
