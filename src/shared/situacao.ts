/**
 * Soft delete: organizações, lotes e usuários têm o campo `ativo`.
 * Listagens e consultas mostram apenas registros ATIVOS por padrão; use ?situacao=inativos ou ?situacao=todos.
 */
export type Situacao = 'ativos' | 'inativos' | 'todos';
export const SITUACOES: string[] = ['ativos', 'inativos', 'todos'];

/** Valor do campo `ativo` a filtrar (undefined = sem filtro). */
export function filtroAtivo(situacao: Situacao = 'ativos'): boolean | undefined {
  if (situacao === 'todos') return undefined;
  return situacao === 'ativos';
}

/** O registro (ativo/inativo) é visível na situação pedida? */
export function compativelComSituacao(ativo: boolean, situacao: Situacao = 'ativos'): boolean {
  return situacao === 'todos' || (situacao === 'ativos') === ativo;
}
