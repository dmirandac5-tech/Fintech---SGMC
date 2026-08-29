/**
 * Objeto de Valor Dinero (6.2). Inmutable, con moneda, y siempre en centavos
 * enteros: no se usa punto flotante para representar importes.
 */

export type CodigoMoneda = 'GTQ' | 'USD';

/** Escala de las tasas (12 decimales) para operar en aritmética entera. */
const ESCALA_TASA = 1_000_000_000_000n;

/** División entera hacia -infinito; BigInt trunca hacia cero. */
function divisionPiso(numerador: bigint, denominador: bigint): bigint {
  const cociente = numerador / denominador;
  const hayResto = numerador % denominador !== 0n;
  const signosDistintos = numerador < 0n !== denominador < 0n;
  return hayResto && signosDistintos ? cociente - 1n : cociente;
}

function dividirMedioArriba(numerador: bigint, denominador: bigint): bigint {
  return divisionPiso(numerador * 2n + denominador, denominador * 2n);
}

/**
 * Redondea a entero, medio hacia arriba. El epsilon compensa la
 * representación binaria: 725.76 * 100 vale 72575.99999999999.
 */
function enteroMedioArriba(valor: number): bigint {
  if (!Number.isFinite(valor)) {
    throw new Error(`Dinero: valor no finito (${valor})`);
  }
  return BigInt(Math.floor(valor + 0.5 + 1e-9));
}

/** Parsea "10000.00" a centavos sin pasar por punto flotante. */
function centavosDesdeTexto(monto: string): bigint {
  const limpio = monto.trim();
  const coincidencia = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!coincidencia) {
    throw new Error(`Dinero: monto con formato inválido: "${monto}"`);
  }
  const signo = coincidencia[1] === '-' ? -1n : 1n;
  const entero = BigInt(coincidencia[2] ?? '0');
  const decimales = (coincidencia[3] ?? '').padEnd(2, '0');
  return signo * (entero * 100n + BigInt(decimales));
}

export class Dinero {
  private constructor(
    private readonly centavos: bigint,
    private readonly moneda: CodigoMoneda,
  ) {}

  static deCentavos(centavos: bigint | number, moneda: CodigoMoneda = 'GTQ'): Dinero {
    if (typeof centavos === 'number') {
      if (!Number.isInteger(centavos)) {
        throw new Error(`Dinero.deCentavos exige un entero de centavos, se recibió ${centavos}`);
      }
      return new Dinero(BigInt(centavos), moneda);
    }
    return new Dinero(centavos, moneda);
  }

  /** La forma en texto ("1004.62") es exacta; la numérica se redondea. */
  static deQuetzales(monto: string | number, moneda: CodigoMoneda = 'GTQ'): Dinero {
    const centavos = typeof monto === 'string' ? centavosDesdeTexto(monto) : enteroMedioArriba(monto * 100);
    return new Dinero(centavos, moneda);
  }

  static cero(moneda: CodigoMoneda = 'GTQ'): Dinero {
    return new Dinero(0n, moneda);
  }

  private exigirMismaMoneda(otro: Dinero): void {
    if (this.moneda !== otro.moneda) {
      throw new Error(`No se pueden operar importes de monedas distintas: ${this.moneda} y ${otro.moneda}`);
    }
  }

  sumar(otro: Dinero): Dinero {
    this.exigirMismaMoneda(otro);
    return new Dinero(this.centavos + otro.centavos, this.moneda);
  }

  restar(otro: Dinero): Dinero {
    this.exigirMismaMoneda(otro);
    return new Dinero(this.centavos - otro.centavos, this.moneda);
  }

  /**
   * Multiplica por una tasa y redondea a centavos. El factor se escala a
   * entero antes de multiplicar, de modo que el producto es exacto.
   */
  multiplicarPor(factor: number): Dinero {
    const factorEscalado = enteroMedioArriba(factor * Number(ESCALA_TASA));
    return new Dinero(dividirMedioArriba(this.centavos * factorEscalado, ESCALA_TASA), this.moneda);
  }

  /** Reparte en n partes truncando; el remanente lo absorbe quien llama. */
  dividirEntre(partes: number): Dinero {
    if (!Number.isInteger(partes) || partes <= 0) {
      throw new Error(`Dinero.dividirEntre exige un entero positivo, se recibió ${partes}`);
    }
    return new Dinero(divisionPiso(this.centavos, BigInt(partes)), this.moneda);
  }

  negar(): Dinero {
    return new Dinero(-this.centavos, this.moneda);
  }

  esCero(): boolean {
    return this.centavos === 0n;
  }

  esPositivo(): boolean {
    return this.centavos > 0n;
  }

  esNegativo(): boolean {
    return this.centavos < 0n;
  }

  esMayorQue(otro: Dinero): boolean {
    this.exigirMismaMoneda(otro);
    return this.centavos > otro.centavos;
  }

  esMenorQue(otro: Dinero): boolean {
    this.exigirMismaMoneda(otro);
    return this.centavos < otro.centavos;
  }

  esIgualA(otro: Dinero): boolean {
    return this.moneda === otro.moneda && this.centavos === otro.centavos;
  }

  minimo(otro: Dinero): Dinero {
    this.exigirMismaMoneda(otro);
    return this.centavos <= otro.centavos ? this : otro;
  }

  centavosValor(): bigint {
    return this.centavos;
  }

  get codigoMoneda(): CodigoMoneda {
    return this.moneda;
  }

  /** Formato plano con 2 decimales: "1004.62". */
  toString(): string {
    const negativo = this.centavos < 0n;
    const absoluto = negativo ? -this.centavos : this.centavos;
    const enteros = absoluto / 100n;
    const decimales = (absoluto % 100n).toString().padStart(2, '0');
    return `${negativo ? '-' : ''}${enteros}.${decimales}`;
  }

  /** Formato de presentación: "Q1,004.62". */
  toStringConMoneda(): string {
    const [enteros = '0', decimales = '00'] = this.toString().replace('-', '').split('.');
    const conSeparadores = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${this.centavos < 0n ? '-' : ''}Q${conSeparadores}.${decimales}`;
  }
}
