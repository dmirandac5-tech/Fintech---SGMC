/**
 * Política de crédito: tasas, base de conteo y política de adelanto (6.1, 6.3.1).
 * Son parámetros con vigencia, autor y fecha, no constantes del código: un
 * crédito se calcula con la política vigente en su fecha de otorgamiento.
 */

export type BaseConteo = 'ACTUAL_360' | 'ACTUAL_365' | 'TREINTA_360';

export type PoliticaAdelanto = 'AMORTIZACION_CAPITAL' | 'CUOTAS_FUTURAS';

export interface PoliticaCredito {
  readonly id: string;
  /** Tasa nominal anual del interés corriente (0.36 = 36 %). */
  readonly tasaNominalAnual: number;
  readonly tasaMoratoriaAnual: number;
  readonly baseConteo: BaseConteo;
  readonly politicaAdelanto: PoliticaAdelanto;
  readonly vigenteDesde: Date;
  /** null = vigente indefinidamente. */
  readonly vigenteHasta: Date | null;
  readonly autor: string;
}

const DIAS_POR_BASE: Record<BaseConteo, number> = {
  ACTUAL_360: 360,
  ACTUAL_365: 365,
  TREINTA_360: 360,
};

/** No hay tope legal de tasas, pero sí control interno (6.3.1). */
const TASA_ANUAL_MAXIMA_RAZONABLE = 1.2;

export function crearPoliticaCredito(politica: PoliticaCredito): PoliticaCredito {
  const { tasaNominalAnual, tasaMoratoriaAnual, vigenteDesde, vigenteHasta } = politica;
  for (const [nombre, tasa] of [
    ['tasaNominalAnual', tasaNominalAnual],
    ['tasaMoratoriaAnual', tasaMoratoriaAnual],
  ] as const) {
    if (!Number.isFinite(tasa) || tasa < 0 || tasa > TASA_ANUAL_MAXIMA_RAZONABLE) {
      throw new Error(
        `PoliticaCredito: ${nombre} fuera del rango razonable [0, ${TASA_ANUAL_MAXIMA_RAZONABLE}]: ${tasa}`,
      );
    }
  }
  if (vigenteHasta !== null && vigenteHasta.getTime() <= vigenteDesde.getTime()) {
    throw new Error('PoliticaCredito: vigenteHasta debe ser posterior a vigenteDesde');
  }
  return Object.freeze({ ...politica });
}

/** i = TNA / 12, proporcional (6.3). */
export function tasaMensual(politica: PoliticaCredito): number {
  return politica.tasaNominalAnual / 12;
}

/** TNA moratoria / base de conteo (6.3). */
export function tasaMoratoriaDiaria(politica: PoliticaCredito): number {
  return politica.tasaMoratoriaAnual / DIAS_POR_BASE[politica.baseConteo];
}

export function diasDeLaBase(base: BaseConteo): number {
  return DIAS_POR_BASE[base];
}

/** Política vigente en una fecha; si hay varias, la de vigencia más reciente. */
export function politicaVigenteEn(
  politicas: readonly PoliticaCredito[],
  fecha: Date,
): PoliticaCredito {
  const instante = fecha.getTime();
  const vigentes = politicas.filter(
    (p) =>
      p.vigenteDesde.getTime() <= instante &&
      (p.vigenteHasta === null || instante < p.vigenteHasta.getTime()),
  );
  const masReciente = vigentes.reduce<PoliticaCredito | null>(
    (elegida, candidata) =>
      elegida === null || candidata.vigenteDesde.getTime() > elegida.vigenteDesde.getTime()
        ? candidata
        : elegida,
    null,
  );
  if (masReciente === null) {
    throw new Error(`No hay política de crédito vigente en ${fecha.toISOString()}`);
  }
  return masReciente;
}
