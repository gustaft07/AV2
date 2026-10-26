import { EntidadeBase } from "./EntidadeBase";

export interface MovimentacaoJSON {
  id: string;
  criadoEm: string;
  equipamentoId: string;
  tipo: string;
  ator: string;
  observacao?: string;
}

export class Movimentacao extends EntidadeBase {
  equipamentoId: string;
  tipo: string;
  ator: string;
  observacao?: string;

  constructor(dados: {
    id?: string;
    criadoEm?: string;
    equipamentoId: string;
    tipo: string;
    ator: string;
    observacao?: string;
  }) {
    super(dados.id, dados.criadoEm);
    this.equipamentoId = dados.equipamentoId;
    this.tipo = dados.tipo;
    this.ator = dados.ator;
    this.observacao = dados.observacao;
  }

  validar(): void {
    this.exigir(this.equipamentoId.trim().length > 0, "equipamentoId é obrigatório.");
    this.exigir(this.tipo.trim().length > 0, "Tipo de movimentação é obrigatório.");
  }

  paraJSON(): MovimentacaoJSON {
    return {
      id: this.id,
      criadoEm: this.criadoEm,
      equipamentoId: this.equipamentoId,
      tipo: this.tipo,
      ator: this.ator,
      observacao: this.observacao,
    };
  }

  static deJSON(j: MovimentacaoJSON): Movimentacao {
    return new Movimentacao(j);
  }
}
