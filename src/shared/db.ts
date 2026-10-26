import type { Prisma, PrismaClient } from '@prisma/client';

/** Aceita o client normal ou o client transacional recebido em $transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;
