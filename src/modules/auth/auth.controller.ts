import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

export class AuthController {
  private service: AuthService;

  constructor(private app: FastifyInstance) {
    this.service = new AuthService(new AuthRepository(app.prisma));
  }

  login = async (
    req: FastifyRequest<{ Body: { login: string; senha: string } }>,
    reply: FastifyReply,
  ) => {
    const payload = await this.service.validarCredenciais(req.body.login, req.body.senha);
    const token = this.app.jwt.sign(payload);
    return reply.send({ token });
  };

  me = async (req: FastifyRequest, reply: FastifyReply) =>
    reply.send({ id: req.user.sub, login: req.user.login, papel: req.user.papel });
}
