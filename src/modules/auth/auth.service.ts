import { hashSenha, verificarSenha } from '../../core/crypto';
import type { Papel } from '../../domain/Papel';
import { UnauthorizedError } from '../../shared/errors';
import { AuthRepository } from './auth.repository';

export class AuthService {
  constructor(private repo: AuthRepository) {}

  /** Valida o login (mesmo esquema hash+sal da AV1) e devolve o payload do JWT. */
  async validarCredenciais(login: string, senha: string) {
    const usuario = await this.repo.findByLogin(login);

    if (!usuario || !usuario.ativo) {
      hashSenha(senha); // iguala o tempo de resposta e não revela se o login existe
      throw new UnauthorizedError('Credenciais inválidas');
    }
    if (!verificarSenha(senha, usuario.hashSenha, usuario.saltSenha)) {
      throw new UnauthorizedError('Credenciais inválidas');
    }
    return { sub: usuario.id, login: usuario.login, papel: usuario.papel as Papel };
  }
}
