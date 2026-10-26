export const paginacaoQuery = {
  page: { type: 'integer', minimum: 1, default: 1 },
  limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
} as const;

export interface Paginacao {
  page: number;
  limit: number;
}

export function calcularPaginacao({ page, limit }: Paginacao) {
  return { skip: (page - 1) * limit, take: limit };
}

export function respostaPaginada<T>(data: T[], total: number, { page, limit }: Paginacao) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
