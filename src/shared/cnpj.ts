export function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, '');
}
