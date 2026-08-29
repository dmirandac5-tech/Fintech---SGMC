/** Prelación de pagos (6.6): pago exacto, de menos y de más. */

import { describe, expect, it } from 'vitest';
import { Dinero } from '../src/dominio/dinero';
import {
  aplicarPrelacion,
  construirCadenaPrelacion,
  montoAplicadoA,
  totalAdeudado,
  type DeudaCuota,
} from '../src/dominio/prelacion-pago';

/** Rubros de la cuota 2 vencida hace 15 días (6.6.1). */
const DEUDA_CUOTA_2: DeudaCuota = {
  gastos: Dinero.deQuetzales('0.00'),
  interesMoratorio: Dinero.deQuetzales('7.26'),
  interesCorriente: Dinero.deQuetzales('278.86'),
  capital: Dinero.deQuetzales('725.76'),
};

describe('Rubros de la cuota vencida (6.6.1)', () => {
  it('el total adeudado es Q1,011.88', () => {
    expect(totalAdeudado(DEUDA_CUOTA_2).toString()).toBe('1011.88');
  });

  it('equivale a la cuota normal más la mora de los 15 días', () => {
    const cuotaNormal = Dinero.deQuetzales('1004.62');
    expect(cuotaNormal.sumar(Dinero.deQuetzales('7.26')).toString()).toBe('1011.88');
  });
});

describe('Orden de aplicación (6.6.2)', () => {
  it('la cadena aplica los rubros en el orden gastos, moratorio, corriente, capital', () => {
    const resultado = aplicarPrelacion(Dinero.deQuetzales('1011.88'), DEUDA_CUOTA_2);
    expect(resultado.aplicaciones.map((a) => a.rubro)).toEqual([
      'GASTOS',
      'INTERES_MORATORIO',
      'INTERES_CORRIENTE',
      'CAPITAL',
    ]);
  });

  it('la cadena está formada por cuatro eslabones encadenados', () => {
    const primero = construirCadenaPrelacion();
    expect(primero.rubro).toBe('GASTOS');
    const recorrido = primero.manejar(
      { remanente: Dinero.deQuetzales('1011.88'), aplicaciones: [] },
      DEUDA_CUOTA_2,
    );
    expect(recorrido.aplicaciones).toHaveLength(4);
  });
});

describe('Escenario A — pago exacto (6.6.3)', () => {
  const resultado = aplicarPrelacion(Dinero.deQuetzales('1011.88'), DEUDA_CUOTA_2);

  it('aplica 0.00 a gastos, 7.26 a mora, 278.86 a interés y 725.76 a capital', () => {
    expect(montoAplicadoA(resultado, 'GASTOS').toString()).toBe('0.00');
    expect(montoAplicadoA(resultado, 'INTERES_MORATORIO').toString()).toBe('7.26');
    expect(montoAplicadoA(resultado, 'INTERES_CORRIENTE').toString()).toBe('278.86');
    expect(montoAplicadoA(resultado, 'CAPITAL').toString()).toBe('725.76');
  });

  it('no deja excedente y la cuota queda saldada', () => {
    expect(resultado.excedente.toString()).toBe('0.00');
    expect(resultado.quedaSaldada).toBe(true);
  });
});

describe('Escenario B — pago de menos (6.6.4)', () => {
  const resultado = aplicarPrelacion(Dinero.deQuetzales('500.00'), DEUDA_CUOTA_2);

  it('cubre mora e interés completos y abona el resto a capital', () => {
    expect(montoAplicadoA(resultado, 'INTERES_MORATORIO').toString()).toBe('7.26');
    expect(montoAplicadoA(resultado, 'INTERES_CORRIENTE').toString()).toBe('278.86');
    expect(montoAplicadoA(resultado, 'CAPITAL').toString()).toBe('213.88');
  });

  it('deja pendientes Q511.88 de capital', () => {
    const pendiente = DEUDA_CUOTA_2.capital.restar(montoAplicadoA(resultado, 'CAPITAL'));
    expect(pendiente.toString()).toBe('511.88');
  });

  it('la cuota no queda saldada y no hay excedente', () => {
    expect(resultado.quedaSaldada).toBe(false);
    expect(resultado.excedente.toString()).toBe('0.00');
  });

  it('un pago insuficiente nunca se rechaza: se registra igual', () => {
    expect(() => aplicarPrelacion(Dinero.deQuetzales('1.00'), DEUDA_CUOTA_2)).not.toThrow();
    const minimo = aplicarPrelacion(Dinero.deQuetzales('1.00'), DEUDA_CUOTA_2);
    expect(montoAplicadoA(minimo, 'INTERES_MORATORIO').toString()).toBe('1.00');
    expect(montoAplicadoA(minimo, 'CAPITAL').toString()).toBe('0.00');
  });
});

describe('Escenario C — pago de más (6.6.5)', () => {
  const resultado = aplicarPrelacion(Dinero.deQuetzales('3000.00'), DEUDA_CUOTA_2);

  it('salda la cuota vencida por completo', () => {
    expect(resultado.quedaSaldada).toBe(true);
    expect(montoAplicadoA(resultado, 'CAPITAL').toString()).toBe('725.76');
  });

  it('deja un excedente de Q1,988.12', () => {
    expect(resultado.excedente.toString()).toBe('1988.12');
  });

  it('el excedente es exactamente lo recibido menos lo adeudado: nunca se pierde', () => {
    const esperado = Dinero.deQuetzales('3000.00').restar(totalAdeudado(DEUDA_CUOTA_2));
    expect(resultado.excedente.esIgualA(esperado)).toBe(true);
  });
});

describe('El orden de prelación es una regla de negocio', () => {
  it('con gastos de por medio, se cobran antes que la mora', () => {
    const conGastos: DeudaCuota = { ...DEUDA_CUOTA_2, gastos: Dinero.deQuetzales('50.00') };
    const resultado = aplicarPrelacion(Dinero.deQuetzales('55.00'), conGastos);
    expect(montoAplicadoA(resultado, 'GASTOS').toString()).toBe('50.00');
    expect(montoAplicadoA(resultado, 'INTERES_MORATORIO').toString()).toBe('5.00');
    expect(montoAplicadoA(resultado, 'CAPITAL').toString()).toBe('0.00');
  });

  it('lo aplicado más el excedente siempre reconstruye el monto recibido', () => {
    for (const monto of ['0.00', '1.00', '500.00', '1011.88', '3000.00']) {
      const resultado = aplicarPrelacion(Dinero.deQuetzales(monto), DEUDA_CUOTA_2);
      const suma = resultado.aplicaciones
        .reduce((total, a) => total.sumar(a.monto), Dinero.cero())
        .sumar(resultado.excedente);
      expect(suma.toString()).toBe(Dinero.deQuetzales(monto).toString());
    }
  });

  it('rechaza un monto negativo', () => {
    expect(() => aplicarPrelacion(Dinero.deQuetzales('-1.00'), DEUDA_CUOTA_2)).toThrow(
      /no puede ser negativo/,
    );
  });
});
