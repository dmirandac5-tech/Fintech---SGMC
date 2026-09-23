/**
 * Clasificacion por tramo de atraso (CP-01, seccion 7.2 del enunciado P2).
 * Es una Specification: dado un numero de dias, devuelve el tramo y los
 * limites de ese tramo. El tramo es un atributo derivado del dato, no un estado.
 */
import { TramoMora } from '../calculadora-mora';

/** Limite inferior (inclusive) y superior (inclusive) de dias de cada tramo. */
export interface RangoTramo {
  readonly desde: number;
  readonly hasta: number;
}

/**
 * Tabla de tramos del enunciado P2 (7.2).
 * Mora 1: 1-30 · Mora 2: 31-60 · Mora 3: 61-90 · Vencido: 91-120 · Incobrable: >120.
 */
export const RANGOS_TRAMO: Readonly<Record<TramoMora, RangoTramo | null>> = {
  AL_DIA: null, // 0 dias, sin rango de mora
  MORA_1: { desde: 1, hasta: 30 },
  MORA_2: { desde: 31, hasta: 60 },
  MORA_3: { desde: 61, hasta: 90 },
  VENCIDO: { desde: 91, hasta: 120 },
  INCOBRABLE: { desde: 121, hasta: Number.MAX_SAFE_INTEGER },
};

/**
 * Dias que una cuota con `diasAtraso` dias pasa dentro del tramo dado.
 *
 * dias_en_tramo(d, ini, fin) = max(0, min(d, fin) - ini + 1)
 *
 * Ejemplo: con 45 dias de atraso, en Mora  ́1 (1-30) esta  ́30 dias y en Mora  ́2 (31-60)
 * esta  ́15 dias. Esta es la base de la regla de "tramos recorridos" (7.3).
 */
export function diasEnTramo(diasAtraso: number, tramo: TramoMora): number {
  const rango = RANGOS_TRAMO[tramo];
  if (rango === null) {
    // AL_DIA no tiene dias de mora.

    return 0;
  }
  return Math.max(0, Math.min(diasAtraso, rango.hasta) - rango.desde + 1);
}

/**
 * Tramo actual de una cuota segun sus dias de atraso.
 * Reutiliza la clasificacion del P1 para mantener una sola fuente de verdad.


 */
export function clasificarTramo(diasAtraso: number): TramoMora {
  if (diasAtraso < 0) {
    throw new Error(`Los dias de atraso no pueden ser negativos: ${diasAtraso}`);
  }
  if (diasAtraso === 0) return 'AL_DIA';
  if (diasAtraso <= 30) return 'MORA_1';
  if (diasAtraso <= 60) return 'MORA_2';
  if (diasAtraso <= 90) return 'MORA_3';
  if (diasAtraso <= 120) return 'VENCIDO';
  return 'INCOBRABLE';
}

/**
 * Tramo siguiente en orden de gravedad (para recorrer de Mora 1 hacia abajo).
 * Devuelve null si no hay tramo mas grave (INCOBRABLE.
 */
export function tramoSiguiente(tramo: TramoMora): TramoMora | null {
  const orden: readonly TramoMora[] = ['MORA_1', 'MORA_2', 'MORA_3', 'VENCIDO', 'INCOBRABLE'];
  const indice = orden.indexOf(tramo);
  if (indice === -1 || indice === orden.length - 1) return null;
  return orden[indice + 1] ?? null;
}