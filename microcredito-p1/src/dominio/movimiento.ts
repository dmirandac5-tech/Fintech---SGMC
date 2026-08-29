/**
 * Movimientos del mayor (6.9). Los saldos no se sobrescriben: se registran
 * movimientos y el saldo resulta de acumularlos, de modo que cualquier cifra
 * de un cierre puede reconstruirse después. El registro es append-only.
 */

import { Dinero } from './dinero';

export type TipoMovimiento =
  | 'DESEMBOLSO'
  | 'PAGO_GASTOS'
  | 'PAGO_MORA'
  | 'PAGO_INTERES'
  | 'PAGO_CAPITAL'
  | 'ADELANTO_CAPITAL'
  | 'CASTIGO_INCOBRABLE'
  | 'RECUPERACION_INCOBRABLE';

export interface Movimiento {
  readonly numero: number;
  readonly creditoId: string;
  readonly tipo: TipoMovimiento;
  readonly monto: Dinero;
  readonly fecha: Date;
  readonly cuotaNumero: number | null;
  readonly claveIdempotencia: string | null;
}

const AUMENTAN_CAPITAL: ReadonlySet<TipoMovimiento> = new Set<TipoMovimiento>(['DESEMBOLSO']);

const DISMINUYEN_CAPITAL: ReadonlySet<TipoMovimiento> = new Set<TipoMovimiento>([
  'PAGO_CAPITAL',
  'ADELANTO_CAPITAL',
  'CASTIGO_INCOBRABLE',
]);

/**
 * Reconstruye el saldo de capital acumulando el mayor. Los cobros de gastos,
 * mora e interés no tocan el principal.
 */
export function saldoCapitalDesdeMovimientos(
  movimientos: readonly Movimiento[],
  moneda: Dinero = Dinero.cero(),
): Dinero {
  return movimientos.reduce((saldo, movimiento) => {
    if (AUMENTAN_CAPITAL.has(movimiento.tipo)) return saldo.sumar(movimiento.monto);
    if (DISMINUYEN_CAPITAL.has(movimiento.tipo)) return saldo.restar(movimiento.monto);
    return saldo;
  }, Dinero.cero(moneda.codigoMoneda));
}

/** Total cobrado por concepto; lo usan las recuperaciones del cierre. */
export function totalPorTipo(
  movimientos: readonly Movimiento[],
  tipo: TipoMovimiento,
  moneda: Dinero = Dinero.cero(),
): Dinero {
  return movimientos
    .filter((m) => m.tipo === tipo)
    .reduce((total, m) => total.sumar(m.monto), Dinero.cero(moneda.codigoMoneda));
}
