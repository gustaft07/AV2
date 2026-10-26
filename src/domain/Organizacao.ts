import { EntidadeBase } from "./EntidadeBase";
import { validarCNPJ } from "../core/validation";

export interface OrganizacaoJSON {
  id: string;
  criadoEm: string;
  codigo: string;
  razaoSocial: string;
  cnpj: string;
  contratoColeta: string;
  prazoArmazenamentoDias: number;
}

export class Organizacao extends EntidadeBase {
  codigo: string;
  razaoSocial: string;
  cnpj: string;
  contratoColeta: string;
  prazoArmazenamentoDias: number;

  constructor(dados: {
    id?: string;
    criadoEm?: string;
    codigo: string;
    razaoSocial: string;
    cnpj: string;
    contratoColeta: string;
    prazoArmazenamentoDias?: number;
  }) {
    super(dados.id, dados.criadoEm);
    this.codigo = dados.codigo;
    this.razaoSocial = dados.razaoSocial;
    this.cnpj = dados.cnpj;
    this.contratoColeta = dados.contratoColeta;
    this.prazoArmazenamentoDias = dados.prazoArmazenamentoDias ?? 90;
  }

  validar(): void {
    this.exigir(this.codigo.trim().length > 0, "Código da organização é obrigatório.");
    this.exigir(this.razaoSocial.trim().length > 0, "Razão social é obrigatória.");
    this.exigir(validarCNPJ(this.cnpj), "CNPJ inválido.");
  }

  paraJSON(): OrganizacaoJSON {
    return {
      id: this.id,
      criadoEm: this.criadoEm,
      codigo: this.codigo,
      razaoSocial: this.razaoSocial,
      cnpj: this.cnpj,
      contratoColeta: this.contratoColeta,
      prazoArmazenamentoDias: this.prazoArmazenamentoDias,
    };
  }

  static deJSON(j: OrganizacaoJSON): Organizacao {
    return new Organizacao(j);
  }
}
