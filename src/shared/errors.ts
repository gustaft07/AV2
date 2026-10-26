export class AppError extends Error {
  constructor(message: string, public statusCode = 500) {
    super(message);
    this.name = new.target.name;
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') { super(message, 401); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Sem permissão') { super(message, 403); }
}
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') { super(message, 404); }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflito') { super(message, 409); }
}
// Regras de negócio do domínio usam ErroValidacao (src/core/validation.ts) -> 422 no error-handler.
