import { buildApp } from './app';
import { env } from './config/env';

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recebido, encerrando...`);
    const force = setTimeout(() => process.exit(1), 10_000); // trava de segurança
    force.unref();
    try {
      // para de aceitar conexões, aguarda as ativas e executa os hooks onClose (desconecta o Prisma)
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  // No Windows, SIGINT (Ctrl+C) funciona; SIGTERM tem suporte limitado. Mantemos ambos.
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//Cliente não encontrado: Peter Parker