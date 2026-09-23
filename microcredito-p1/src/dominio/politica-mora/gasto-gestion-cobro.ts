/**
 * Gasto de gestion de cobro en campo (CP-02, seccion 7.5).
 * Q25.00 fijos por cuota vencida, generado UNA sola vez cuando la cuota
 * alcanza 31 dias de atraso (entrada a Mora 2). No se cobra en Mora 1.
 * Es idempotente: reejecutar el cierre del mismo dia no genera un gasto nuevo.
 */
import { Dinero, CodigoMoneda } from '../dinero';

/** Monto fijo del gasto de gestion de cobro por cuota vencida. */
export const MONTO_GASTO_GESTION = 25.00;

/** Dia de atraso en que se genera el gasto (entrada a Mora 2). */
export const DIA_GENERA_GASTO = 31;

/**
 * Determina si una cuota vencida genera el gasto de gestion de cobro.
 * Se genera si la cuota tiene 31 dias o mas de atraso (Mora 2 o superior).
 */
export function generaGastoGestion(diasAtraso: number): boolean {
  return diasAtraso >= DIA_GENERA_GASTO;
}

/**
 * Devuelve el gasto de gestion de cobro de una cuota vencida.
 * Devuelve Dinero.cero si la cuota NO genera el gasto (menos de 31 dias).
 * La idempotencia se garantiza en la capa de aplicacion: el gasto se registra
 * una sola vez por cuota vencida, con clave de idempotencia.
 */
export function gastoGestionCobro(
  moneda: CodigoMoneda,
  diasAtraso: number,
): Dinero {
  if (generaGastoGestion(diasAtraso)) {
    return Dinero.deQuetzales(MONTO_GASTO_GESTION, moneda);
  }
  return Dinero.cero(moneda);
}