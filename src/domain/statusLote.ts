import type { StatusEquipamento } from "../core/validation";

export function statusUnico(statuses: readonly StatusEquipamento[]): StatusEquipamento | null {
  if (statuses.length === 0) return null;
  const primeiro = statuses[0];
  return statuses.every((s) => s === primeiro) ? primeiro : null;
}
