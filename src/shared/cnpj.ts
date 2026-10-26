/** Remove a máscara e devolve só os dígitos (formato armazenado no banco). */
export function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, '');
}
