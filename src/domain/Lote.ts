import { EntidadeBase } from "./EntidadeBase";
import { validarDataEntradaLote } from "../core/validation";

export interface LoteJSON {
  id: string;
  criadoEm: string;
  codigoLote: string;
  organizacaoCodigo: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada: string; 
}

export class Lote extends EntidadeBase {
  codigoLote: string;
  organizacaoCodigo: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada: string;

  constructor(dados: {
    id?: string;
    criadoEm?: string;
    codigoLote: string;
    organizacaoCodigo: string;
    notaFiscal: string;
    transportadora: string;
    dataEntrada?: string;
  }) {
    super(dados.id, dados.criadoEm);
    this.codigoLote = dados.codigoLote;
    this.organizacaoCodigo = dados.organizacaoCodigo;
    this.notaFiscal = dados.notaFiscal;
    this.transportadora = dados.transportadora;
    this.dataEntrada = dados.dataEntrada ?? new Date().toISOString();
  }

  validar(): void {
    this.exigir(this.codigoLote.trim().length > 0, "Código do lote é obrigatório.");
    this.exigir(this.notaFiscal.trim().length > 0, "Nota fiscal é obrigatória.");
    this.exigir(this.transportadora.trim().length > 0, "Transportadora é obrigatória.");
    validarDataEntradaLote(this.dataEntrada);
  }

  paraJSON(): LoteJSON {
    return {
      id: this.id,
      criadoEm: this.criadoEm,
      codigoLote: this.codigoLote,
      organizacaoCodigo: this.organizacaoCodigo,
      notaFiscal: this.notaFiscal,
      transportadora: this.transportadora,
      dataEntrada: this.dataEntrada,
    };
  }

  static deJSON(j: LoteJSON): Lote {
    return new Lote(j);
  }
}
