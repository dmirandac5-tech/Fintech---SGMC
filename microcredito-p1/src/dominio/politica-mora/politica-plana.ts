/**
 * Politica de mora plana al 24% nominal anual (la del Proyecto 1, seccion 6.5).
 * Se conserva para los creditos otorgados antes del 1 de octubre de 2026 (CP-03).
 * La prueba original del P1 (Q7.26 a 15 dias) debe seguir pasando con esta politica.
 */
import { Dinero } from '../dinero';

/** Tasa moratoria plana del P1: 24% nominal anual. */
export const TNA_MORATORIA_PLANA = 0.24;

/** Base de conteo: Actual/360. */
const DIAS_BASE = 360;

/** Tasa diaria: TNA / 360. */
export function tasaDiariaPlana(): number {
  return TNA_MORATORIA_PLANA / DIAS_BASE;
}

/**
 * Interes moratorio con politica plana.
 * interes = capital_en_mora * tasa_diaria * dias
 * Se redondea una sola vez al final, igual que en el P1.
 */
export function calcularMoratorioPlano(
  capitalEnMora: Dinero,
  diasAtraso: number,
): Dinero {
  if (diasAtraso < 0) {
    throw new Error(`Los dias de atraso no pueden ser negativos: ${diasAtraso}`);
  }
  if (capitalEnMora.esNegativo()) {
    throw new Error('El capital en mora no puede ser negativo');
  }
  if (diasAtraso === 0 || capitalEnMora.esCero()) {
    return Dinero.cero(capitalEnMora.codigoMoneda);
  }
  return capitalEnMora.multiplicarPor(tasaDiariaPlana() * diasAtraso);
}