import { Papel } from '../domain/Papel';

export const PERMISSOES = {
  // Usuários (recurso administrativo)
  lerUsuarios: [Papel.ADMIN, Papel.AUDITOR],
  gerirUsuarios: [Papel.ADMIN],

  // Organizações e contratos de coleta
  lerCadastro: [Papel.ADMIN, Papel.OPERADOR_CADASTRO, Papel.AUDITOR],
  gerirCadastro: [Papel.ADMIN, Papel.OPERADOR_CADASTRO],

  // Lotes, equipamentos e movimentações
  lerAlmoxarifado: [Papel.ADMIN, Papel.GESTOR_ALMOXARIFADO, Papel.AUDITOR],
  gerirAlmoxarifado: [Papel.ADMIN, Papel.GESTOR_ALMOXARIFADO],

  // Relatórios (papel do auditor)
  relatorios: [Papel.ADMIN, Papel.AUDITOR],

  // Exclusão física (destrutiva e em cascata) de organização, lote e usuário
  exclusaoDefinitiva: [Papel.ADMIN],
} as const;
