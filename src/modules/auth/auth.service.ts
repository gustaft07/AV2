import { hashSenha, verificarSenha } from '../../core/crypto';
import type { Papel } from '../../domain/Papel';
import { UnauthorizedError } from '../../shared/errors';
import { AuthRepository } from './auth.repository';

export class AuthService {
  constructor(private repo: AuthRepository) {}

  async validarCredenciais(login: string, senha: string) {
    const usuario = await this.repo.findByLogin(login);

    if (!usuario || !usuario.ativo) {
      hashSenha(senha); 
      throw new UnauthorizedError('Credenciais inválidas');
    }
    if (!verificarSenha(senha, usuario.hashSenha, usuario.saltSenha)) {
      throw new UnauthorizedError('Credenciais inválidas');
    }
    return { sub: usuario.id, login: usuario.login, papel: usuario.papel as Papel };
  }
}
