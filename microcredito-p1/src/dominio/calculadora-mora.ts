/**
 * Interés moratorio y clasificación por tramos (6.5, 6.7.1).
 * El tramo es un atributo derivado de los días de atraso, no un estado.
 */

import { Dinero } from './dinero';
import { tasaMoratoriaDiaria, type PoliticaCredito } from './politica-credito';

export type TramoMora = 'AL_DIA' | 'MORA_1' | 'MORA_2' | 'MORA_3' | 'VENCIDO' | 'INCOBRABLE';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Límite superior de días de cada tramo (6.5). */
export const LIMITES_TRAMO = {
  MORA_1: 30,
  MORA_2: 60,
  MORA_3: 90,
  VENCIDO: 120,
} as const;

export const DIAS_UMBRAL_CARTERA_EN_RIESGO = 30;

export const DIAS_SUSPENSION_DEVENGO = 90;

/** Días calendario hasta la fecha de corte; 0 si la cuota aún no vence. */
export function calcularDiasAtraso(fechaVencimiento: Date, fechaCorte: Date): number {
  const diferencia = fechaCorte.getTime() - fechaVencimiento.getTime();
  return Math.max(0, Math.round(diferencia / MILISEGUNDOS_POR_DIA));
}

/**
 * Clasifica el tramo a partir de los días de atraso vigentes. Al ser una
 * función del dato actual, el tramo sube y baja según los pagos.
 */
export function clasificarTramoMora(diasAtraso: number): TramoMora {
  if (diasAtraso < 0) {
    throw new Error(`Los días de atraso no pueden ser negativos: ${diasAtraso}`);
  }
  if (diasAtraso === 0) return 'AL_DIA';
  if (diasAtraso <= LIMITES_TRAMO.MORA_1) return 'MORA_1';
  if (diasAtraso <= LIMITES_TRAMO.MORA_2) return 'MORA_2';
  if (diasAtraso <= LIMITES_TRAMO.MORA_3) return 'MORA_3';
  if (diasAtraso <= LIMITES_TRAMO.VENCIDO) return 'VENCIDO';
  return 'INCOBRABLE';
}

/**
 * interes_moratorio = capital_en_mora * tasa_moratoria_diaria * dias (6.5).
 *
 * Se aplica solo sobre el capital de la cuota vencida, nunca sobre el total de
 * la cuota, que incluye interés: el Código Civil prohíbe el anatocismo.
 * El producto tasa por días se resuelve antes de multiplicar el importe, para
 * redondear una sola vez.
 */
export function calcularInteresMoratorio(
  capitalEnMora: Dinero,
  politica: PoliticaCredito,
  diasAtraso: number,
): Dinero {
  if (diasAtraso < 0) {
    throw new Error(`Los días de atraso no pueden ser negativos: ${diasAtraso}`);
  }
  if (capitalEnMora.esNegativo()) {
    throw new Error('El capital en mora no puede ser negativo');
  }
  if (diasAtraso === 0 || capitalEnMora.esCero()) {
    return Dinero.cero(capitalEnMora.codigoMoneda);
  }
  return capitalEnMora.multiplicarPor(tasaMoratoriaDiaria(politica) * diasAtraso);
}

export interface CuotaVencida {
  readonly numero: number;
  readonly capitalEnMora: Dinero;
  readonly diasAtraso: number;
}

/** Cada cuota vencida aporta su propio moratorio; no se calcula sobre la suma. */
export function calcularInteresMoratorioTotal(
  cuotasVencidas: readonly CuotaVencida[],
  politica: PoliticaCredito,
  moneda: Dinero = Dinero.cero(),
): Dinero {
  return cuotasVencidas.reduce(
    (acumulado, cuota) =>
      acumulado.sumar(calcularInteresMoratorio(cuota.capitalEnMora, politica, cuota.diasAtraso)),
    Dinero.cero(moneda.codigoMoneda),
  );
}

/** Pasados los 90 días se deja de devengar interés corriente (6.5). */
export function debeSuspenderDevengo(diasAtraso: number): boolean {
  return diasAtraso > DIAS_SUSPENSION_DEVENGO;
}
