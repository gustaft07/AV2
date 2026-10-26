import { EntidadeBase } from "./EntidadeBase";
import {
  ErroValidacao,
  EstadoFisico,
  StatusEquipamento,
  exigeJustificativa,
  validarTransicaoParaDesmonte,
} from "../core/validation";
import { transicaoStatusPermitida } from "./transicoesStatus";

export interface EquipamentoJSON {
  id: string;
  criadoEm: string;
  codigoBarras: string;
  loteId: string;
  tipo: string; 
  estadoFisico: EstadoFisico;
  status: StatusEquipamento;
  historicoEstado: { de: EstadoFisico; para: EstadoFisico; justificativa?: string; em: string }[];
}

export class Equipamento extends EntidadeBase {
  codigoBarras: string;
  loteId: string;
  tipo: string;
  estadoFisico: EstadoFisico;
  status: StatusEquipamento;
  historicoEstado: EquipamentoJSON["historicoEstado"];

  constructor(dados: {
    id?: string;
    criadoEm?: string;
    codigoBarras?: string; // AV2: opcional; por padrão é o próprio id (gerado automaticamente)
    loteId: string;
    tipo: string;
    estadoFisico: EstadoFisico;
    status?: StatusEquipamento;
    historicoEstado?: EquipamentoJSON["historicoEstado"];
  }) {
    super(dados.id, dados.criadoEm);
    this.codigoBarras = dados.codigoBarras ?? this.id; // AV2: o código de barras é o id do equipamento
    this.loteId = dados.loteId;
    this.tipo = dados.tipo;
    this.estadoFisico = dados.estadoFisico;
    this.status = dados.status ?? "recebido";
    this.historicoEstado = dados.historicoEstado ?? [];
  }

  validar(): void {
    this.exigir(this.codigoBarras.trim().length > 0, "Código de barras é obrigatório.");
    this.exigir(this.tipo.trim().length > 0, "Tipo de equipamento é obrigatório.");
  }

  alterarEstadoFisico(novoEstado: EstadoFisico, justificativa?: string): void {
    const precisaJustificar = exigeJustificativa(this.estadoFisico, novoEstado);
    if (precisaJustificar && (!justificativa || justificativa.trim().length < 5)) {
      // AV1 lançava `Error`; trocado por ErroValidacao (subclasse de Error) para a API responder 422.
      throw new ErroValidacao(
        `Justificativa textual obrigatória (mín. 5 caracteres) ao rebaixar de ` +
          `"${this.estadoFisico}" para "${novoEstado}" (queda de 2+ categorias).`
      );
    }
    this.historicoEstado.push({
      de: this.estadoFisico,
      para: novoEstado,
      justificativa,
      em: new Date().toISOString(),
    });
    this.estadoFisico = novoEstado;
  }

  moverParaDesmonte(): void {
    validarTransicaoParaDesmonte(this.status);
    this.status = "desmonte";
  }

  /** Acréscimo da AV2: troca de status para a API. "desmonte" continua usando a regra da AV1. */
  alterarStatus(novoStatus: StatusEquipamento): void {
    if (novoStatus === "desmonte") {
      this.moverParaDesmonte();
      return;
    }
    if (!transicaoStatusPermitida(this.status, novoStatus)) {
      throw new ErroValidacao(`Transição de status inválida: "${this.status}" → "${novoStatus}".`);
    }
    this.status = novoStatus;
  }

  paraJSON(): EquipamentoJSON {
    return {
      id: this.id,
      criadoEm: this.criadoEm,
      codigoBarras: this.codigoBarras,
      loteId: this.loteId,
      tipo: this.tipo,
      estadoFisico: this.estadoFisico,
      status: this.status,
      historicoEstado: this.historicoEstado,
    };
  }

  static deJSON(j: EquipamentoJSON): Equipamento {
    return new Equipamento(j);
  }
}
