/** Política y crédito de referencia compartidos por las pruebas. */

import { Dinero } from '../src/dominio/dinero';
import { Credito } from '../src/dominio/credito';
import { crearPoliticaCredito, type PoliticaCredito } from '../src/dominio/politica-credito';

/** TNA 36 %, moratoria 24 %, Actual/360. */
export const POLITICA_2026: PoliticaCredito = crearPoliticaCredito({
  id: 'POL-2026-01',
  tasaNominalAnual: 0.36,
  tasaMoratoriaAnual: 0.24,
  baseConteo: 'ACTUAL_360',
  politicaAdelanto: 'AMORTIZACION_CAPITAL',
  vigenteDesde: new Date(Date.UTC(2026, 0, 1)),
  vigenteHasta: null,
  autor: 'comite-de-credito',
});

export const FECHA_SOLICITUD = new Date(Date.UTC(2026, 0, 10));
export const FECHA_DESEMBOLSO = new Date(Date.UTC(2026, 0, 15));

/** Vencimientos derivados del desembolso: cuota k vence el 15 de cada mes. */
export const VENCE_CUOTA_1 = new Date(Date.UTC(2026, 1, 15));
export const VENCE_CUOTA_2 = new Date(Date.UTC(2026, 2, 15));

/** 15 días después del vencimiento de la cuota 2: el corte del ejemplo de 6.6. */
export const CORTE_15_DIAS_ATRASO = new Date(Date.UTC(2026, 2, 30));

/** Q10,000.00 a 12 meses, ya desembolsado. */
export function creditoDesembolsado(): Credito {
  const credito = Credito.solicitar({
    id: 'C-REF',
    clienteId: 'CLI-001',
    montoSolicitado: Dinero.deQuetzales('10000.00'),
    plazoMeses: 12,
    fechaSolicitud: FECHA_SOLICITUD,
  });
  credito.aprobar(FECHA_SOLICITUD);
  credito.desembolsar({ fechaDesembolso: FECHA_DESEMBOLSO, politicas: [POLITICA_2026] });
  return credito;
}

/** Punto de partida de los tres escenarios de pago de 6.6. */
export function creditoConCuota1Pagada(): Credito {
  const credito = creditoDesembolsado();
  credito.registrarPago({
    monto: Dinero.deQuetzales('1004.62'),
    fechaCorte: VENCE_CUOTA_1,
    claveIdempotencia: 'PAGO-CUOTA-1',
  });
  return credito;
}
