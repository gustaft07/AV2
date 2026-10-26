import { Equipamento } from "./Equipamento";
import { Lote } from "./Lote";
import { Organizacao } from "./Organizacao";
import { Usuario } from "./Usuario";
import { Papel } from "./Papel";
import { EstadoFisico } from "../core/validation";
import { hashSenha } from "../core/crypto";

export class FabricaEntidades {
  static criarOrganizacao(dados: {
    codigo: string;
    razaoSocial: string;
    cnpj: string;
    contratoColeta: string;
    prazoArmazenamentoDias?: number;
  }): Organizacao {
    const org = new Organizacao(dados);
    org.validar();
    return org;
  }

  static criarLote(dados: {
    codigoLote: string;
    organizacaoCodigo: string;
    notaFiscal: string;
    transportadora: string;
    dataEntrada?: string;
  }): Lote {
    const lote = new Lote(dados);
    lote.validar();
    return lote;
  }

  static criarEquipamento(dados: {
    codigoBarras?: string; 

    loteId: string;
    tipo: string;
    estadoFisico: EstadoFisico;
  }): Equipamento {
    const equip = new Equipamento(dados);
    equip.validar();
    return equip;
  }

  static criarUsuario(dados: {
    login: string;
    senha: string;
    papel: Papel;
  }): Usuario {
    const { hash, salt } = hashSenha(dados.senha);
    const usuario = new Usuario({
      login: dados.login,
      hashSenha: hash,
      saltSenha: salt,
      papel: dados.papel,
    });
    usuario.validar();
    return usuario;
  }
}
