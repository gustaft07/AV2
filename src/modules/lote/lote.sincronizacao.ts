import type { Db } from '../../shared/db';
import { statusUnico } from '../../domain/statusLote';
import { EquipamentoRepository } from '../equipamento/equipamento.repository';
import { LoteRepository } from './lote.repository';

export async function sincronizarStatusDoLote(
  db: Db,
  loteId: string,
  loteRepo: LoteRepository,
  equipRepo: EquipamentoRepository,
): Promise<void> {
  const lote = await loteRepo.findById(db, loteId);
  if (!lote) return;
  const comum = statusUnico(await equipRepo.statusDosEquipamentos(db, loteId));
  if (comum && comum !== lote.status) {
    await loteRepo.definirStatus(db, loteId, comum);
  }
}
