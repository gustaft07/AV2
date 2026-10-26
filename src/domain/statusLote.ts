import type { StatusEquipamento } from "../core/validation";

/**
 * Regra do professor (AV2): o status do lote só muda quando TODOS os equipamentos
 * dele estiverem com o mesmo status. Um único equipamento adiantado não move o lote.
 *
 * Devolve o status comum, ou null quando não há equipamentos ou eles divergem
 * (nesse caso o lote mantém o status que já tinha).
 */
export function statusUnico(statuses: readonly StatusEquipamento[]): StatusEquipamento | null {
  if (statuses.length === 0) return null;
  const primeiro = statuses[0];
  return statuses.every((s) => s === primeiro) ? primeiro : null;
}
