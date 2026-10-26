import * as crypto from "crypto";
import { ErroValidacao } from "../core/validation";

export interface Persistivel {
  paraJSON(): object;
}

export abstract class EntidadeBase implements Persistivel {
  readonly id: string;
  readonly criadoEm: string;

  protected constructor(id?: string, criadoEm?: string) {
    this.id = id ?? crypto.randomUUID();
    this.criadoEm = criadoEm ?? new Date().toISOString();
  }

  abstract validar(): void;

  abstract paraJSON(): object;

  protected exigir(condicao: boolean, mensagem: string): void {
    if (!condicao) throw new ErroValidacao(mensagem);
  }
}
