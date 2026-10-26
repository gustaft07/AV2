export class ErroValidacao extends Error {}


export function validarCNPJ(cnpjEntrada: string): boolean {
  const cnpj = cnpjEntrada.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; 

  const calcularDigito = (base: string, pesos: number[]): number => {
    const soma = base
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  const d2 = calcularDigito(cnpj.slice(0, 12) + d1, pesos2);

  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

export function validarDataEntradaLote(dataISO: string, agora: Date = new Date()): void {
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) {
    throw new ErroValidacao("Data de entrada inválida.");
  }
  if (data.getTime() > agora.getTime()) {
    throw new ErroValidacao("Data de entrada não pode ser futura.");
  }
  const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;
  if (agora.getTime() - data.getTime() > NOVENTA_DIAS_MS) {
    throw new ErroValidacao(
      "Data de entrada não pode ser anterior a mais de 90 dias."
    );
  }
}


export const ESCALA_ESTADO_FISICO = [
  "novo",
  "seminovo",
  "usado_bom",
  "usado_regular",
  "usado_ruim",
  "sucata",
] as const;
export type EstadoFisico = (typeof ESCALA_ESTADO_FISICO)[number];

export function indiceEstado(estado: EstadoFisico): number {
  return ESCALA_ESTADO_FISICO.indexOf(estado);
}

export function exigeJustificativa(
  estadoAnterior: EstadoFisico,
  estadoNovo: EstadoFisico
): boolean {
  return indiceEstado(estadoNovo) - indiceEstado(estadoAnterior) >= 2;
}

export const STATUS_EQUIPAMENTO = [
  "recebido",
  "triagem",
  "triagem_completa",
  "desmonte",
  "reciclagem",
  "descarte_seguro",
  "revenda",
] as const;
export type StatusEquipamento = (typeof STATUS_EQUIPAMENTO)[number];

export function validarTransicaoParaDesmonte(
  statusAtual: StatusEquipamento
): void {
  if (statusAtual !== "triagem_completa") {
    throw new ErroValidacao(
      `Equipamento não pode ir para desmonte a partir de "${statusAtual}". ` +
        `É necessário concluir a triagem completa primeiro.`
    );
  }
}
