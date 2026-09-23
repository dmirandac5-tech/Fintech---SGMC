/**
 * Desglose de cartera en riesgo por tramo (CP-04.3, seccion  ́7.8).
 * Reproduce el oraculo del tablero sobre la cartera de siete creditos del P1.
 * Los saldos son los reales del reporte: C-001 = Q620,000, C-002 = Q124,000, etc.
 */
import { describe, it, expect } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import { clasificarTramo } from '../src/dominio/politica-mora/clasificacion-tramo';

/** Un credito con su saldo de capital y sus dias de atraso. */
interface CreditoCartera {
  readonly id: string;
  readonly saldoCapital: string;
  readonly diasAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

// Cartera del oraculo 7.8 (saldos reales del reporte del P1).
const CARTERA: readonly CreditoCartera[] = [
  { id: 'C-001', saldoCapital: '620000.00', diasAtraso: 0, reestructurado: false, incobrable: false },
  { id: 'C-002', saldoCapital: '124000.00', diasAtraso: 8, reestructurado: false, incobrable: false },
  { id: 'C-003', saldoCapital: '24000.00', diasAtraso: 45, reestructurado: false, incobrable: false },
  { id: 'C-004', saldoCapital: '18000.00', diasAtraso: 75, reestructurado: false, incobrable: false },
  { id: 'C-005', saldoCapital: '8000.00', diasAtraso: 100, reestructurado: false, incobrable: false },
  { id: 'C-006', saldoCapital: '6000.00', diasAtraso: 0, reestructurado: true, incobrable: false },
  { id: 'C-007', saldoCapital: '15000.00', diasAtraso: 210, reestructurado: false, incobrable: true },
];

/** Suma los saldos de capital de la cartera activa (excluye incobrables). */
function carteraActiva(): Dinero {
  const total = CARTERA
    .filter((c) => !c.incobrable)
    .reduce((acum, c) => acum.sumar(Dinero.deQuetzales(c.saldoCapital)), Dinero.cero());
  return total;
}

/** Un credito cuenta como en riesgo si tiene mas de 30 dias o esta reestructurado. */
function enRiesgo(c: CreditoCartera): boolean {
  return c.diasAtraso > 30 || c.reestructurado;
}

/** Suma el saldo de capital de los creditos que cumplen el predicado. */
function sumarSaldos(predicado: (c: CreditoCartera) => boolean): Dinero {
  return CARTERA
    .filter((c) => !c.incobrable && predicado(c))
    .reduce((acum, c) => acum.sumar(Dinero.deQuetzales(c.saldoCapital)), Dinero.cero());
}

/** Proporcion como numero (convertir bigint a number para poder dividir). */
function proporcion(parte: Dinero, total: Dinero): number {
  return Number(parte.centavosValor()) / Number(total.centavosValor());
}

describe('Orculo del tablero - cartera en riesgo por tramo (7.8)', () => {
  it('La cartera activa es Q800,000.00', () => {
    expect(carteraActiva().toString()).toBe('800000.00');
  });

  it('Cartera en mora (todo atraso >=  ́1 dia) es Q174,000.00 = 21.75%', () => {
    const enMora = sumarSaldos((c) => c.diasAtraso >=1);
    expect(enMora.toString()).toBe('174000.00');
    expect(proporcion(enMora, carteraActiva())).toBeCloseTo(0.2175, 4);  });

  it('Cartera en riesgo(mas de 30 dias o reestructurado) es Q56,000.00 =  ́7.00%', () => {
    const riesgo = sumarSaldos(enRiesgo);
    expect(riesgo.toString()).toBe('56000.00');
    expect(proporcion(riesgo, carteraActiva())).toBeCloseTo(0.07, 4);  });

  it('Desglose por tramo: Mora  ́2 =  ́3.00%, Mora  ́3 =  ́2.25%, Vencido =  ́1.00%, Reestructurado =  ́0.75%', () => {
    const mora2 = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'MORA_2');
    expect(mora2.toString()).toBe('24000.00');

    const mora3 = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'MORA_3');
    expect(mora3.toString()).toBe('18000.00');

    const vencido = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'VENCIDO');
    expect(vencido.toString()).toBe('8000.00');

    const reestructurado = sumarSaldos((c) => c.reestructurado);
    expect(reestructurado.toString()).toBe('6000.00');
  });

  it('La suma de los porcentajes por tramo es 7.00% (sin errores de redondeo)', () => {
    const mora2 = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'MORA_2');
    const mora3 = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'MORA_3');
    const vencido = sumarSaldos((c) => clasificarTramo(c.diasAtraso) === 'VENCIDO');
    const reestructurado = sumarSaldos((c) => c.reestructurado);

    const totalRiesgo = mora2.sumar(mora3).sumar(vencido).sumar(reestructurado);
    expect(totalRiesgo.toString()).toBe('56000.00');
    expect(proporcion(totalRiesgo, carteraActiva())).toBeCloseTo(0.07, 4);
  });

  it('Dar por incobrable a C-005 baja el indicador de 7.00% a 6.06%', () => {
    const riesgoSinC005 = sumarSaldos(enRiesgo).restar(Dinero.deQuetzales('8000.00'));
    const carteraSinC005 = carteraActiva().restar(Dinero.deQuetzales('8000.00'));
    expect(proporcion(riesgoSinC005, carteraSinC005)).toBeCloseTo(0.0606, 4);  });
});