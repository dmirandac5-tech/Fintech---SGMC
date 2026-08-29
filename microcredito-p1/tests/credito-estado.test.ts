/** Ciclo de vida del crédito (6.7) y aplicación de pagos sobre el agregado. */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { Credito } from '../src/dominio/credito';
import { TransicionInvalidaError } from '../src/dominio/estado-credito';
import { relojFijo } from '../src/dominio/reloj';
import {
  CORTE_15_DIAS_ATRASO,
  FECHA_DESEMBOLSO,
  FECHA_SOLICITUD,
  POLITICA_2026,
  VENCE_CUOTA_1,
  creditoConCuota1Pagada,
  creditoDesembolsado,
} from './fixtures';

/** Corte en el que la cuota 1 lleva 45 días y la cuota 2 lleva 17. */
const CORTE_45_DIAS = new Date(Date.UTC(2026, 3, 1));
/** Corte muy posterior: la cuota 1 lleva 136 días (más de 120). */
const CORTE_136_DIAS = new Date(Date.UTC(2026, 6, 1));

function creditoSolicitado(): Credito {
  return Credito.solicitar({
    id: 'C-001',
    clienteId: 'CLI-001',
    montoSolicitado: Dinero.deQuetzales('10000.00'),
    plazoMeses: 12,
    fechaSolicitud: FECHA_SOLICITUD,
  });
}

describe('Originación (tabla 6.7.1)', () => {
  it('un crédito nace SOLICITADO', () => {
    expect(creditoSolicitado().estadoActual).toBe('SOLICITADO');
  });

  it('solicitado + comité aprueba = APROBADO', () => {
    const credito = creditoSolicitado();
    credito.aprobar(FECHA_SOLICITUD);
    expect(credito.estadoActual).toBe('APROBADO');
  });

  it('solicitado + comité rechaza = RECHAZADO (terminal)', () => {
    const credito = creditoSolicitado();
    credito.rechazar(FECHA_SOLICITUD);
    expect(credito.estadoActual).toBe('RECHAZADO');
    expect(() => credito.aprobar(FECHA_SOLICITUD)).toThrow(TransicionInvalidaError);
  });

  it('aprobado + se desembolsa = VIGENTE, con el plan ya construido', () => {
    const credito = creditoDesembolsado();
    expect(credito.estadoActual).toBe('VIGENTE');
    expect(credito.plan.cuotas).toHaveLength(12);
    expect(credito.saldoCapital().toString()).toBe('10000.00');
  });

  it('aprobado + el cliente desiste antes del desembolso = ANULADO (terminal)', () => {
    const credito = creditoSolicitado();
    credito.aprobar(FECHA_SOLICITUD);
    credito.anular(FECHA_DESEMBOLSO);
    expect(credito.estadoActual).toBe('ANULADO');
  });

  it('el crédito se calcula con la política vigente en su fecha de otorgamiento', () => {
    const credito = creditoDesembolsado();
    expect(credito.politica.id).toBe(POLITICA_2026.id);
    expect(credito.plan.tasaPeriodica).toBeCloseTo(0.03, 12);
  });
});

describe('Transiciones inválidas rechazadas por diseño', () => {
  it('un crédito SOLICITADO no puede recibir un pago', () => {
    const credito = creditoSolicitado();
    expect(() =>
      credito.registrarPago({
        monto: Dinero.deQuetzales('1000.00'),
        fechaCorte: VENCE_CUOTA_1,
        claveIdempotencia: 'X-1',
      }),
    ).toThrow(TransicionInvalidaError);
  });

  it('un crédito RECHAZADO no puede recibir un pago', () => {
    const credito = creditoSolicitado();
    credito.rechazar(FECHA_SOLICITUD);
    expect(() =>
      credito.registrarPago({
        monto: Dinero.deQuetzales('1000.00'),
        fechaCorte: VENCE_CUOTA_1,
        claveIdempotencia: 'X-2',
      }),
    ).toThrow(/no se puede "registrar un pago" un crédito en estado RECHAZADO/);
  });

  it('un crédito SOLICITADO no puede desembolsarse sin aprobación previa', () => {
    expect(() =>
      creditoSolicitado().desembolsar({
        fechaDesembolso: FECHA_DESEMBOLSO,
        politicas: [POLITICA_2026],
      }),
    ).toThrow(TransicionInvalidaError);
  });

  it('un crédito CANCELADO no puede volver a entrar en mora', () => {
    const credito = creditoDesembolsado();
    credito.registrarPago({
      monto: Dinero.deQuetzales('20000.00'),
      fechaCorte: VENCE_CUOTA_1,
      claveIdempotencia: 'LIQUIDA',
    });
    expect(credito.estadoActual).toBe('CANCELADO');
    expect(() => credito.actualizarPorCorte(CORTE_45_DIAS)).toThrow(TransicionInvalidaError);
  });

  it('un crédito VIGENTE no puede declararse incobrable', () => {
    const credito = creditoDesembolsado();
    expect(() => credito.declararIncobrable(CORTE_136_DIAS)).toThrow(TransicionInvalidaError);
  });
});

describe('Deterioro: vigente pasa a EN_MORA (6.7.1)', () => {
  it('una cuota impagada que vence marca el crédito EN_MORA', () => {
    const credito = creditoConCuota1Pagada();
    expect(credito.estadoActual).toBe('VIGENTE');
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);
    expect(credito.estadoActual).toBe('EN_MORA');
    expect(credito.diasAtraso(CORTE_15_DIAS_ATRASO)).toBe(15);
    expect(credito.tramoMora(CORTE_15_DIAS_ATRASO)).toBe('MORA_1');
  });

  it('el tramo sube sin cambiar el estado: en mora es uno solo', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    expect(credito.estadoActual).toBe('EN_MORA');
    expect(credito.tramoMora(CORTE_45_DIAS)).toBe('MORA_2');
    credito.actualizarPorCorte(CORTE_136_DIAS);
    expect(credito.estadoActual).toBe('EN_MORA');
    expect(credito.tramoMora(CORTE_136_DIAS)).toBe('INCOBRABLE');
  });
});

describe('Escenario A — pago exacto (6.6.3) sobre el agregado', () => {
  it('salda la cuota 2 y regulariza el crédito de mora a vigente', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);
    expect(credito.estadoActual).toBe('EN_MORA');

    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('1011.88'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'PAGO-EXACTO',
    });

    const cuota2 = recibo.porCuota.find((c) => c.cuotaNumero === 2);
    expect(cuota2?.diasAtraso).toBe(15);
    expect(cuota2?.aplicaciones.map((a) => a.monto.toString())).toEqual([
      '0.00',
      '7.26',
      '278.86',
      '725.76',
    ]);
    expect(recibo.excedente.toString()).toBe('0.00');
    expect(recibo.estadoAnterior).toBe('EN_MORA');
    expect(recibo.estadoNuevo).toBe('VIGENTE');
    expect(recibo.diasAtrasoDespues).toBe(0);
    expect(credito.saldoCapital().toString()).toBe('8569.62');
  });
});

describe('Escenario B — pago de menos (6.6.4) sobre el agregado', () => {
  it('reduce la deuda pero no regulariza: el crédito sigue en mora', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);

    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('500.00'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'PAGO-PARCIAL',
    });

    expect(recibo.porCuota[0]?.aplicaciones.map((a) => a.monto.toString())).toEqual([
      '0.00',
      '7.26',
      '278.86',
      '213.88',
    ]);
    expect(recibo.estadoNuevo).toBe('EN_MORA');
    expect(recibo.diasAtrasoDespues).toBe(15);
    // Capital pendiente: 9,295.38 (tras pagar la cuota 1) menos los 213.88 abonados.
    expect(credito.saldoCapital().toString()).toBe('9081.50');
    // La cuota 2 no queda saldada: aún debe 725.76 - 213.88 = 511.88 de capital.
    expect(recibo.porCuota[0]?.aplicaciones[3]?.monto.toString()).toBe('213.88');
  });

  it('nunca se rechaza un pago por ser insuficiente', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);
    expect(() =>
      credito.registrarPago({
        monto: Dinero.deQuetzales('1.00'),
        fechaCorte: CORTE_15_DIAS_ATRASO,
        claveIdempotencia: 'PAGO-MINIMO',
      }),
    ).not.toThrow();
  });
});

describe('Escenario C — pago de más (6.6.5) sobre el agregado', () => {
  it('salda la cuota vencida y aplica el excedente a capital', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);

    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('3000.00'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'PAGO-EXCEDENTE',
    });

    expect(recibo.excedente.toString()).toBe('1988.12');
    expect(recibo.destinoExcedente).toBe('AMORTIZACION_CAPITAL');
    expect(recibo.estadoNuevo).toBe('VIGENTE');
    // 8,569.62 de capital pendiente menos el excedente aplicado.
    expect(credito.saldoCapital().toString()).toBe('6581.50');
  });

  it('el excedente nunca se pierde: queda registrado en el mayor', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);
    credito.registrarPago({
      monto: Dinero.deQuetzales('3000.00'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'PAGO-EXCEDENTE',
    });
    const adelantos = credito
      .librosDelMayor()
      .filter((m) => m.tipo === 'ADELANTO_CAPITAL')
      .reduce((total, m) => total.sumar(m.monto), Dinero.cero());
    expect(adelantos.toString()).toBe('1988.12');
  });

  it('si el excedente cancela todo el saldo, el crédito pasa a CANCELADO', () => {
    const credito = creditoDesembolsado();
    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('15000.00'),
      fechaCorte: VENCE_CUOTA_1,
      claveIdempotencia: 'CANCELA-TODO',
    });
    expect(credito.estadoActual).toBe('CANCELADO');
    expect(credito.saldoCapital().toString()).toBe('0.00');
    // No se cobran los intereses de los meses que ya no transcurrirán:
    // sobra dinero respecto del capital, y queda a favor del cliente.
    expect(recibo.destinoExcedente).toBe('AMORTIZACION_CAPITAL');
    expect(credito.excedenteAFavor().esPositivo()).toBe(true);
  });
});

describe('Reversibilidad del ciclo de vida (6.7)', () => {
  it('45 días de atraso clasifica en MORA_2', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    expect(credito.diasAtraso(CORTE_45_DIAS)).toBe(45);
    expect(credito.tramoMora(CORTE_45_DIAS)).toBe('MORA_2');
    expect(credito.estadoActual).toBe('EN_MORA');
  });

  it('un pago que reduce el atraso baja de tramo y el crédito sigue en mora', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);

    // Paga la cuota 1 completa: capital 704.62 + interés 300.00 + mora de 45 días 21.14.
    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('1025.76'),
      fechaCorte: CORTE_45_DIAS,
      claveIdempotencia: 'PAGA-CUOTA-1-ATRASADA',
    });

    expect(recibo.tramoAntes).toBe('MORA_2');
    expect(recibo.tramoDespues).toBe('MORA_1');
    expect(recibo.estadoNuevo).toBe('EN_MORA');
    expect(credito.diasAtraso(CORTE_45_DIAS)).toBe(17);
  });

  it('si paga todo lo vencido, regulariza a vigente', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    credito.registrarPago({
      monto: Dinero.deQuetzales('1025.76'),
      fechaCorte: CORTE_45_DIAS,
      claveIdempotencia: 'PAGA-CUOTA-1-ATRASADA',
    });
    // Cuota 2: capital 725.76 + interés 278.86 + mora de 17 días 8.23.
    const recibo = credito.registrarPago({
      monto: Dinero.deQuetzales('1012.85'),
      fechaCorte: CORTE_45_DIAS,
      claveIdempotencia: 'PAGA-CUOTA-2-ATRASADA',
    });

    expect(recibo.diasAtrasoDespues).toBe(0);
    expect(recibo.tramoDespues).toBe('AL_DIA');
    expect(credito.estadoActual).toBe('VIGENTE');
  });
});

describe('Reestructuración (6.7)', () => {
  it('en_mora + acuerdo del comité = REESTRUCTURADO, y queda marcado', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    credito.reestructurar(CORTE_45_DIAS);
    expect(credito.estadoActual).toBe('REESTRUCTURADO');
    expect(credito.esReestructurado).toBe(true);
  });

  it('reestructurado + cumple el nuevo plan = vigente, pero sigue marcado en riesgo', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    credito.reestructurar(CORTE_45_DIAS);
    credito.cumplirNuevoPlan(CORTE_45_DIAS);
    expect(credito.estadoActual).toBe('VIGENTE');
    // La transición es operativa, no estadística: la marca no se borra.
    expect(credito.esReestructurado).toBe(true);
  });

  it('reestructurado + se atrasa en el nuevo plan = EN_MORA', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    credito.reestructurar(CORTE_45_DIAS);
    credito.actualizarPorCorte(CORTE_136_DIAS);
    expect(credito.estadoActual).toBe('EN_MORA');
  });
});

describe('Incobrable (6.7)', () => {
  it('supera los 120 días sin arreglo = INCOBRABLE, y sale de la cartera', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_136_DIAS);
    expect(credito.diasAtraso(CORTE_136_DIAS)).toBe(136);

    credito.declararIncobrable(CORTE_136_DIAS);
    expect(credito.estadoActual).toBe('INCOBRABLE');
    expect(credito.saldoCapital().toString()).toBe('0.00');
    expect(
      credito.librosDelMayor().some((m) => m.tipo === 'CASTIGO_INCOBRABLE'),
    ).toBe(true);
  });

  it('no se declara incobrable con 120 días o menos', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    expect(() => credito.declararIncobrable(CORTE_45_DIAS)).toThrow(/más de 120 días/);
  });

  it('lo que recupera la casa de cobro no regresa el crédito a la cartera', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_136_DIAS);
    credito.declararIncobrable(CORTE_136_DIAS);

    credito.registrarRecuperacionIncobrable(Dinero.deQuetzales('2000.00'), CORTE_136_DIAS);
    expect(credito.estadoActual).toBe('INCOBRABLE');
    expect(
      credito.librosDelMayor().some((m) => m.tipo === 'RECUPERACION_INCOBRABLE'),
    ).toBe(true);
  });
});

describe('Interés en suspenso (6.5)', () => {
  it('se suspende el devengo al superar los 90 días de atraso', () => {
    const credito = creditoDesembolsado();
    credito.actualizarPorCorte(CORTE_45_DIAS);
    expect(credito.interesEnSuspenso).toBe(false);
    credito.actualizarPorCorte(CORTE_136_DIAS);
    expect(credito.interesEnSuspenso).toBe(true);
  });
});

describe('Idempotencia del registro de pagos (6.10)', () => {
  it('registrar dos veces el mismo pago no altera el saldo', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);

    const primero = credito.registrarPago({
      monto: Dinero.deQuetzales('1011.88'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'MISMA-CLAVE',
    });
    const saldoTrasPrimerPago = credito.saldoCapital().toString();
    const movimientosTrasPrimerPago = credito.librosDelMayor().length;

    const repetido = credito.registrarPago({
      monto: Dinero.deQuetzales('1011.88'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'MISMA-CLAVE',
    });

    expect(repetido.repetido).toBe(true);
    expect(repetido.excedente.toString()).toBe(primero.excedente.toString());
    expect(credito.saldoCapital().toString()).toBe(saldoTrasPrimerPago);
    expect(credito.librosDelMayor()).toHaveLength(movimientosTrasPrimerPago);
  });
});

describe('Invariantes de auditoría (6.9 y 6.10)', () => {
  it('la suma de los movimientos del mayor reproduce el saldo de capital', () => {
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(CORTE_15_DIAS_ATRASO);
    credito.registrarPago({
      monto: Dinero.deQuetzales('3000.00'),
      fechaCorte: CORTE_15_DIAS_ATRASO,
      claveIdempotencia: 'AUDITORIA',
    });
    expect(credito.saldoSegunMayor().toString()).toBe(credito.saldoCapital().toString());
  });

  it('el saldo de capital nunca es negativo', () => {
    const credito = creditoDesembolsado();
    credito.registrarPago({
      monto: Dinero.deQuetzales('99999.00'),
      fechaCorte: VENCE_CUOTA_1,
      claveIdempotencia: 'EXCESO',
    });
    expect(credito.saldoCapital().esNegativo()).toBe(false);
  });

  it('todo cambio de estado queda en el historial con fecha, proceso y motivo', () => {
    const credito = creditoDesembolsado();
    const historial = credito.historialDeEstados();
    expect(historial.length).toBeGreaterThanOrEqual(3);
    expect(historial.map((h) => h.hacia)).toContain('VIGENTE');
    for (const cambio of historial) {
      expect(cambio.motivo).not.toBe('');
      expect(cambio.usuarioOProceso).not.toBe('');
      expect(cambio.fecha).toBeInstanceOf(Date);
    }
  });
});

describe('El núcleo no lee la fecha del sistema (puerto Reloj)', () => {
  it('la fecha de corte llega como parámetro: el resultado es reproducible', () => {
    const reloj = relojFijo(CORTE_15_DIAS_ATRASO);
    const credito = creditoConCuota1Pagada();
    credito.actualizarPorCorte(reloj.hoy());
    expect(credito.diasAtraso(reloj.hoy())).toBe(15);
    // Mismo reloj, mismo resultado, hoy y dentro de un año.
    expect(credito.diasAtraso(reloj.hoy())).toBe(15);
  });
});
