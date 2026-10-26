import { EntidadeBase } from "./EntidadeBase";
import { Papel } from "./Papel";

export interface UsuarioJSON {
  id: string;
  criadoEm: string;
  login: string;
  hashSenha: string;
  saltSenha: string;
  papel: Papel;
  ativo: boolean;
}

export class Usuario extends EntidadeBase {
  login: string;
  hashSenha: string;
  saltSenha: string;
  papel: Papel;
  ativo: boolean;

  constructor(dados: {
    id?: string;
    criadoEm?: string;
    login: string;
    hashSenha: string;
    saltSenha: string;
    papel: Papel;
    ativo?: boolean;
  }) {
    super(dados.id, dados.criadoEm);
    this.login = dados.login;
    this.hashSenha = dados.hashSenha;
    this.saltSenha = dados.saltSenha;
    this.papel = dados.papel;
    this.ativo = dados.ativo ?? true;
  }

  validar(): void {
    this.exigir(this.login.trim().length >= 3, "Login deve ter ao menos 3 caracteres.");
    this.exigir(/^[a-zA-Z0-9._-]+$/.test(this.login), "Login contém caracteres inválidos.");
    this.exigir(Object.values(Papel).includes(this.papel), "Papel inválido.");
  }

  paraJSON(): UsuarioJSON {
    return {
      id: this.id,
      criadoEm: this.criadoEm,
      login: this.login,
      hashSenha: this.hashSenha,
      saltSenha: this.saltSenha,
      papel: this.papel,
      ativo: this.ativo,
    };
  }

  static deJSON(j: UsuarioJSON): Usuario {
    return new Usuario(j);
  }
}
