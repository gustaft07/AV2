export enum Papel {
  ADMIN = "admin",
  OPERADOR_CADASTRO = "operador_cadastro",
  GESTOR_ALMOXARIFADO = "gestor_almoxarifado",
  AUDITOR = "auditor",
}

export const TODOS_OS_PAPEIS: Papel[] = [
  Papel.ADMIN,
  Papel.OPERADOR_CADASTRO,
  Papel.GESTOR_ALMOXARIFADO,
  Papel.AUDITOR,
];

export function descricaoPapel(papel: Papel): string {
  switch (papel) {
    case Papel.ADMIN:
      return "Administrador do sistema (contas de acesso e parâmetros globais)";
    case Papel.OPERADOR_CADASTRO:
      return "Operador de cadastro (organizações e contratos de coleta)";
    case Papel.GESTOR_ALMOXARIFADO:
      return "Gestor de almoxarifado (lotes, triagem, códigos de barras)";
    case Papel.AUDITOR:
      return "Auditor (somente consulta e relatórios)";
  }
}
