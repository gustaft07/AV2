import type { Prisma, PrismaClient } from '@prisma/client';
import { hashSenha } from '../../core/crypto';
import { FabricaEntidades } from '../../domain/FabricaEntidades';
import type { Papel } from '../../domain/Papel';
import type { Ator } from '../../shared/ator';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { calcularPaginacao, respostaPaginada, type Paginacao } from '../../shared/pagination';
import { filtroAtivo, type Situacao } from '../../shared/situacao';
import { UsuarioRepository } from './usuario.repository';

export interface CriarUsuarioInput {
  login: string;
  senha: string;
  papel: Papel;
}

export interface AtualizarUsuarioInput {
  papel?: Papel;
  senha?: string;
  versao: number;
}

export class UsuarioService {
  constructor(
    private prisma: PrismaClient,
    private repo = new UsuarioRepository(),
  ) {}

  async criar(input: CriarUsuarioInput) {
    // a fábrica valida login/papel e gera hash+sal exatamente como no CLI
    const usuario = FabricaEntidades.criarUsuario({
      login: input.login.trim(),
      senha: input.senha,
      papel: input.papel,
    });
    return this.repo.criar(this.prisma, usuario); // login duplicado -> 409 (UNIQUE)
  }

  async listar(f: Paginacao & { situacao?: Situacao }) {
    const where: Prisma.UsuarioWhereInput = {};
    const ativo = filtroAtivo(f.situacao);
    if (ativo !== undefined) where.ativo = ativo;
    const { skip, take } = calcularPaginacao(f);
    const { data, total } = await this.repo.listar(this.prisma, where, skip, take);
    return respostaPaginada(data, total, f);
  }

  private async buscar(id: string) {
    const u = await this.repo.findById(this.prisma, id);
    if (!u) throw new NotFoundError('Usuário não encontrado');
    return u;
  }

  async atualizar(id: string, input: AtualizarUsuarioInput, ator: Ator) {
    const atual = await this.buscar(id);
    if (!atual.ativo) throw new ConflictError('Usuário inativo: reative-o antes de alterar');
    if (id === ator.usuarioId && input.papel && input.papel !== atual.papel) {
      throw new ConflictError('Você não pode alterar o papel da própria conta');
    }

    const data: Prisma.UsuarioUpdateManyMutationInput = {};
    if (input.papel !== undefined) data.papel = input.papel;
    if (input.senha !== undefined) {
      const { hash, salt } = hashSenha(input.senha);
      data.hashSenha = hash;
      data.saltSenha = salt;
    }

    const afetadas = await this.repo.atualizarComVersao(this.prisma, id, input.versao, data);
    if (afetadas === 0) {
      throw new ConflictError('Usuário foi alterado por outra requisição. Recarregue e tente novamente.');
    }
    return this.repo.findById(this.prisma, id);
  }

  /** SOFT DELETE: o usuário deixa de autenticar, mas a conta e o histórico (campo ator) são preservados. */
  async inativar(id: string, ator: Ator) {
    if (id === ator.usuarioId) throw new ConflictError('Você não pode inativar a própria conta');
    const atual = await this.buscar(id);
    if (!atual.ativo) throw new ConflictError('Usuário já está inativo');
    return this.repo.definirAtivo(this.prisma, id, false);
  }

  async reativar(id: string) {
    const atual = await this.buscar(id);
    if (atual.ativo) throw new ConflictError('Usuário já está ativo');
    return this.repo.definirAtivo(this.prisma, id, true);
  }

  /** Exclusão física (delete padrão). As movimentações guardam só o login, então o histórico permanece. */
  async removerDefinitivo(id: string, ator: Ator) {
    if (id === ator.usuarioId) throw new ConflictError('Você não pode excluir a própria conta');
    await this.buscar(id);
    await this.repo.remover(this.prisma, id);
  }
}
