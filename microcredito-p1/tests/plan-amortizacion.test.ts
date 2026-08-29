/** Plan de amortización (6.4), con la tabla de referencia de 6.4.1. */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  construirPlanAmortizacion,
  cuotaFijaFrancesa,
  cuotaNumero,
  metodoFrances,
  metodoSaldosInsolutos,
  sumaAmortizaciones,
  totalAPagar,
  totalIntereses,
} from '../src/dominio/plan-amortizacion';

/** P = Q10,000.00, TNA 36 % (i = 3 % mensual), n = 12. */
const CAPITAL = Dinero.deQuetzales('10000.00');
const TASA_MENSUAL = 0.36 / 12;
const NUMERO_CUOTAS = 12;
const FECHA_DESEMBOLSO = new Date(Date.UTC(2026, 0, 15));

/** Tabla de 6.4.1: [numero, saldoInicial, cuota, interes, amortizacion, saldoFinal]. */
const TABLA_REFERENCIA: ReadonlyArray<readonly [number, string, string, string, string, string]> = [
  [1, '10000.00', '1004.62', '300.00', '704.62', '9295.38'],
  [2, '9295.38', '1004.62', '278.86', '725.76', '8569.62'],
  [3, '8569.62', '1004.62', '257.09', '747.53', '7822.09'],
  [4, '7822.09', '1004.62', '234.66', '769.96', '7052.13'],
  [5, '7052.13', '1004.62', '211.56', '793.06', '6259.07'],
  [6, '6259.07', '1004.62', '187.77', '816.85', '5442.22'],
  [7, '5442.22', '1004.62', '163.27', '841.35', '4600.87'],
  [8, '4600.87', '1004.62', '138.03', '866.59', '3734.28'],
  [9, '3734.28', '1004.62', '112.03', '892.59', '2841.69'],
  [10, '2841.69', '1004.62', '85.25', '919.37', '1922.32'],
  [11, '1922.32', '1004.62', '57.67', '946.95', '975.37'],
  [12, '975.37', '1004.63', '29.26', '975.37', '0.00'],
];

function planDeReferencia() {
  return construirPlanAmortizacion({
    capital: CAPITAL,
    tasaPeriodica: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    fechaDesembolso: FECHA_DESEMBOLSO,
  });
}

describe('Caso de referencia 6.4.1', () => {
  it('calcula la cuota fija en Q1,004.62', () => {
    expect(cuotaFijaFrancesa(CAPITAL, TASA_MENSUAL, NUMERO_CUOTAS).toString()).toBe('1004.62');
  });

  it('genera exactamente 12 cuotas', () => {
    expect(planDeReferencia().cuotas).toHaveLength(12);
  });

  it.each(TABLA_REFERENCIA)(
    'reproduce la fila %i de la tabla del enunciado',
    (numero, saldoInicial, montoCuota, interes, amortizacion, saldoFinal) => {
      const cuota = cuotaNumero(planDeReferencia(), numero);
      expect(cuota.saldoInicial.toString()).toBe(saldoInicial);
      expect(cuota.montoCuota.toString()).toBe(montoCuota);
      expect(cuota.interes.toString()).toBe(interes);
      expect(cuota.amortizacion.toString()).toBe(amortizacion);
      expect(cuota.saldoFinal.toString()).toBe(saldoFinal);
    },
  );

  it('ajusta la última cuota a Q1,004.63: un centavo más que las once anteriores', () => {
    const plan = planDeReferencia();
    expect(cuotaNumero(plan, 11).montoCuota.toString()).toBe('1004.62');
    expect(cuotaNumero(plan, 12).montoCuota.toString()).toBe('1004.63');
  });

  it('reproduce la fila de totales: 12,055.45 / 2,055.45 / 10,000.00', () => {
    const plan = planDeReferencia();
    expect(totalAPagar(plan).toString()).toBe('12055.45');
    expect(totalIntereses(plan).toString()).toBe('2055.45');
    expect(sumaAmortizaciones(plan).toString()).toBe('10000.00');
  });
});

describe('Invariantes del plan (6.10)', () => {
  it('la suma de las amortizaciones es igual al capital desembolsado', () => {
    const plan = planDeReferencia();
    expect(sumaAmortizaciones(plan).esIgualA(CAPITAL)).toBe(true);
  });

  it('el saldo tras la última cuota es 0.00', () => {
    const plan = planDeReferencia();
    const ultima = cuotaNumero(plan, plan.numeroCuotas);
    expect(ultima.saldoFinal.esCero()).toBe(true);
    expect(ultima.saldoFinal.toString()).toBe('0.00');
  });

  it('ningún saldo intermedio es negativo', () => {
    for (const cuota of planDeReferencia().cuotas) {
      expect(cuota.saldoFinal.esNegativo()).toBe(false);
    }
  });

  it.each([
    ['1000.00', 0.36 / 12, 3],
    ['25000.00', 0.48 / 12, 24],
    ['7333.33', 0.29 / 12, 7],
    ['12345.67', 0.18 / 12, 11],
    ['1000.00', 0.055 / 12, 5],
  ])(
    'mantiene los invariantes para P=%s i=%s n=%s (barrido de casos)',
    (capital, tasa, cuotas) => {
      const plan = construirPlanAmortizacion({
        capital: Dinero.deQuetzales(capital),
        tasaPeriodica: tasa,
        numeroCuotas: cuotas,
        fechaDesembolso: FECHA_DESEMBOLSO,
      });
      expect(sumaAmortizaciones(plan).toString()).toBe(capital);
      expect(cuotaNumero(plan, cuotas).saldoFinal.toString()).toBe('0.00');
    },
  );
});

describe('Caso especial i = 0 (6.4)', () => {
  it('no divide entre cero: la cuota es P / n', () => {
    const plan = construirPlanAmortizacion({
      capital: Dinero.deQuetzales('1200.00'),
      tasaPeriodica: 0,
      numeroCuotas: 12,
      fechaDesembolso: FECHA_DESEMBOLSO,
    });
    expect(cuotaNumero(plan, 1).montoCuota.toString()).toBe('100.00');
    expect(cuotaNumero(plan, 1).interes.toString()).toBe('0.00');
    expect(sumaAmortizaciones(plan).toString()).toBe('1200.00');
    expect(cuotaNumero(plan, 12).saldoFinal.toString()).toBe('0.00');
  });

  it('con i = 0 y capital no divisible, la última cuota absorbe el remanente', () => {
    const plan = construirPlanAmortizacion({
      capital: Dinero.deQuetzales('1000.00'),
      tasaPeriodica: 0,
      numeroCuotas: 3,
      fechaDesembolso: FECHA_DESEMBOLSO,
    });
    expect(cuotaNumero(plan, 1).montoCuota.toString()).toBe('333.33');
    expect(cuotaNumero(plan, 3).montoCuota.toString()).toBe('333.34');
    expect(sumaAmortizaciones(plan).toString()).toBe('1000.00');
  });
});

describe('Strategy: el método de interés es un punto de extensión (OCP)', () => {
  it('el método francés produce cuota constante salvo el ajuste final', () => {
    const plan = planDeReferencia();
    expect(plan.metodo).toBe(metodoFrances.nombre);
    const primerasOnce = plan.cuotas.slice(0, 11).map((c) => c.montoCuota.toString());
    expect(new Set(primerasOnce).size).toBe(1);
  });

  it('el método sobre saldos insolutos se agrega sin tocar el motor de cálculo', () => {
    const plan = construirPlanAmortizacion({
      capital: CAPITAL,
      tasaPeriodica: TASA_MENSUAL,
      numeroCuotas: NUMERO_CUOTAS,
      fechaDesembolso: FECHA_DESEMBOLSO,
      estrategia: metodoSaldosInsolutos,
    });
    // Amortización constante: la cuota baja período a período.
    expect(cuotaNumero(plan, 1).amortizacion.toString()).toBe('833.33');
    expect(
      cuotaNumero(plan, 1).montoCuota.esMayorQue(cuotaNumero(plan, 11).montoCuota),
    ).toBe(true);
    // Los invariantes se cumplen igual: los garantiza el Builder, no la estrategia.
    expect(sumaAmortizaciones(plan).toString()).toBe('10000.00');
    expect(cuotaNumero(plan, 12).saldoFinal.toString()).toBe('0.00');
  });
});

describe('Validaciones del Builder', () => {
  it('rechaza un número de cuotas no positivo', () => {
    expect(() =>
      construirPlanAmortizacion({
        capital: CAPITAL,
        tasaPeriodica: TASA_MENSUAL,
        numeroCuotas: 0,
        fechaDesembolso: FECHA_DESEMBOLSO,
      }),
    ).toThrow(/entero positivo/);
  });

  it('rechaza un capital no positivo', () => {
    expect(() =>
      construirPlanAmortizacion({
        capital: Dinero.cero(),
        tasaPeriodica: TASA_MENSUAL,
        numeroCuotas: 12,
        fechaDesembolso: FECHA_DESEMBOLSO,
      }),
    ).toThrow(/capital desembolsado debe ser positivo/);
  });

  it('fecha de vencimiento de la cuota k es k meses después del desembolso', () => {
    const plan = planDeReferencia();
    expect(cuotaNumero(plan, 1).fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(cuotaNumero(plan, 2).fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(cuotaNumero(plan, 12).fechaVencimiento.toISOString().slice(0, 10)).toBe('2027-01-15');
  });
});
