
export type Situacao = 'ativos' | 'inativos' | 'todos';
export const SITUACOES: string[] = ['ativos', 'inativos', 'todos'];

export function filtroAtivo(situacao: Situacao = 'ativos'): boolean | undefined {
  if (situacao === 'todos') return undefined;
  return situacao === 'ativos';
}

export function compativelComSituacao(ativo: boolean, situacao: Situacao = 'ativos'): boolean {
  return situacao === 'todos' || (situacao === 'ativos') === ativo;
}
