/**
 * Imprime los casos de referencia calculados por el núcleo y comprueba las
 * cifras principales. Ejecutar con: npm run reporte
 */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  construirPlanAmortizacion,
  cuotaNumero,
  sumaAmortizaciones,
  totalAPagar,
  totalIntereses,
} from '../src/dominio/plan-amortizacion';
import { calcularInteresMoratorio } from '../src/dominio/calculadora-mora';
import { aplicarPrelacion, montoAplicadoA, type DeudaCuota } from '../src/dominio/prelacion-pago';
import {
  calcularCarteraEnRiesgo,
  porcentajeCarteraEnRiesgo,
  type CreditoEnCartera,
} from '../src/dominio/cartera';
import { POLITICA_2026 } from './fixtures';

const der = (texto: string, ancho: number): string => texto.padStart(ancho, ' ');
const izq = (texto: string, ancho: number): string => texto.padEnd(ancho, ' ');
const linea = (largo = 74): string => '-'.repeat(largo);

function titulo(texto: string): void {
  console.log('');
  console.log(linea());
  console.log(texto);
  console.log(linea());
}

describe('Casos de referencia del enunciado', () => {
  it('Plan de amortización (P = Q10,000.00 · 36% TNA · 12 cuotas)', () => {
    const plan = construirPlanAmortizacion({
      capital: Dinero.deQuetzales('10000.00'),
      tasaPeriodica: 0.36 / 12,
      numeroCuotas: 12,
      fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
    });

    titulo('PLAN DE AMORTIZACION  ·  metodo frances  ·  i = 3% mensual');
    console.log(
      `${izq('Cuota', 7)}${der('Saldo inicial', 15)}${der('Cuota', 12)}${der('Interes', 12)}${der('Amortizacion', 15)}${der('Saldo final', 14)}`,
    );
    console.log(linea());
    for (const cuota of plan.cuotas) {
      console.log(
        izq(String(cuota.numero), 7) +
          der(cuota.saldoInicial.toStringConMoneda(), 15) +
          der(cuota.montoCuota.toStringConMoneda(), 12) +
          der(cuota.interes.toStringConMoneda(), 12) +
          der(cuota.amortizacion.toStringConMoneda(), 15) +
          der(cuota.saldoFinal.toStringConMoneda(), 14),
      );
    }
    console.log(linea());
    console.log(
      izq('TOTALES', 7) +
        der('', 15) +
        der(totalAPagar(plan).toStringConMoneda(), 12) +
        der(totalIntereses(plan).toStringConMoneda(), 12) +
        der(sumaAmortizaciones(plan).toStringConMoneda(), 15) +
        der('Q0.00', 14),
    );

    expect(cuotaNumero(plan, 12).montoCuota.toString()).toBe('1004.63');
    expect(cuotaNumero(plan, 12).saldoFinal.toString()).toBe('0.00');
    expect(sumaAmortizaciones(plan).toString()).toBe('10000.00');
  });

  it('Interés moratorio sobre el capital en mora', () => {
    const capitalEnMora = Dinero.deQuetzales('725.76');
    const moratorio = calcularInteresMoratorio(capitalEnMora, POLITICA_2026, 15);

    titulo('INTERES MORATORIO  ·  cuota 2 vencida hace 15 dias');
    console.log(`  Capital en mora (amortizacion cuota 2) : ${capitalEnMora.toStringConMoneda()}`);
    console.log(`  TNA moratoria                          : 24%`);
    console.log(`  Base de conteo                         : Actual/360`);
    console.log(`  Tasa moratoria diaria                  : 0.24 / 360`);
    console.log(`  Dias de atraso                         : 15`);
    console.log(`  Interes moratorio                      : ${moratorio.toStringConMoneda()}`);

    expect(moratorio.toString()).toBe('7.26');
  });

  it('Prelación de pagos: los tres escenarios', () => {
    const deuda: DeudaCuota = {
      gastos: Dinero.deQuetzales('0.00'),
      interesMoratorio: Dinero.deQuetzales('7.26'),
      interesCorriente: Dinero.deQuetzales('278.86'),
      capital: Dinero.deQuetzales('725.76'),
    };

    titulo('PRELACION DE PAGOS  ·  total adeudado de la cuota 2 = Q1,011.88');
    console.log(
      `${izq('Escenario', 24)}${der('Gastos', 10)}${der('Mora', 10)}${der('Interes', 11)}${der('Capital', 11)}${der('Excedente', 12)}`,
    );
    console.log(linea());
    for (const [nombre, monto] of [
      ['A · pago exacto', '1011.88'],
      ['B · pago de menos', '500.00'],
      ['C · pago de mas', '3000.00'],
    ] as const) {
      const resultado = aplicarPrelacion(Dinero.deQuetzales(monto), deuda);
      console.log(
        izq(`${nombre} (${monto})`, 24) +
          der(montoAplicadoA(resultado, 'GASTOS').toStringConMoneda(), 10) +
          der(montoAplicadoA(resultado, 'INTERES_MORATORIO').toStringConMoneda(), 10) +
          der(montoAplicadoA(resultado, 'INTERES_CORRIENTE').toStringConMoneda(), 11) +
          der(montoAplicadoA(resultado, 'CAPITAL').toStringConMoneda(), 11) +
          der(resultado.excedente.toStringConMoneda(), 12),
      );
    }

    expect(aplicarPrelacion(Dinero.deQuetzales('3000.00'), deuda).excedente.toString()).toBe('1988.12');
  });

  it('Cartera en riesgo, antes y después de dar por incobrable', () => {
    const credito = (
      id: string,
      saldo: string,
      dias: number,
      reestructurado = false,
      incobrable = false,
    ): CreditoEnCartera => ({
      id,
      saldoCapital: Dinero.deQuetzales(saldo),
      diasAtraso: dias,
      reestructurado,
      incobrable,
    });

    const cartera: readonly CreditoEnCartera[] = [
      credito('C-001', '620000.00', 0),
      credito('C-002', '124000.00', 8),
      credito('C-003', '24000.00', 45),
      credito('C-004', '18000.00', 75),
      credito('C-005', '8000.00', 100),
      credito('C-006', '6000.00', 0, true),
      credito('C-007', '15000.00', 210, false, true),
    ];
    const resultado = calcularCarteraEnRiesgo(cartera);

    titulo('CARTERA EN RIESGO');
    console.log(
      `${izq('Credito', 10)}${der('Saldo capital', 16)}${der('Dias', 7)}${izq('  Tramo', 14)}${izq('En riesgo', 11)}`,
    );
    console.log(linea());
    for (const detalle of resultado.detalle) {
      const original = cartera.find((c) => c.id === detalle.id);
      console.log(
        izq(detalle.id, 10) +
          der(detalle.saldoCapital.toStringConMoneda(), 16) +
          der(String(original?.diasAtraso ?? 0), 7) +
          izq(`  ${detalle.tramo}`, 14) +
          izq(detalle.excluido ? 'excluido' : detalle.enRiesgo ? 'si' : 'no', 11),
      );
    }
    console.log(linea());
    console.log(`  Cartera activa   : ${resultado.carteraActiva.toStringConMoneda()}`);
    console.log(`  Monto en riesgo  : ${resultado.carteraEnRiesgo.toStringConMoneda()}`);
    console.log(`  Cartera en riesgo: ${porcentajeCarteraEnRiesgo(resultado).toFixed(2)} %`);

    const trasCastigo = calcularCarteraEnRiesgo(
      cartera.map((c) => (c.id === 'C-005' ? { ...c, incobrable: true } : c)),
    );
    console.log('');
    console.log('  Se castiga C-005 (Q8,000.00, 100 dias) como incobrable:');
    console.log(`  Cartera activa   : ${trasCastigo.carteraActiva.toStringConMoneda()}`);
    console.log(`  Monto en riesgo  : ${trasCastigo.carteraEnRiesgo.toStringConMoneda()}`);
    console.log(`  Cartera en riesgo: ${porcentajeCarteraEnRiesgo(trasCastigo).toFixed(2)} %`);
    console.log(linea());

    expect(porcentajeCarteraEnRiesgo(resultado)).toBe(7.0);
    expect(porcentajeCarteraEnRiesgo(trasCastigo)).toBe(6.06);
  });
});
