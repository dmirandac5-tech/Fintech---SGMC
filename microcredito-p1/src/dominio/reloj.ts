/**
 * Puerto secundario Reloj. El núcleo no lee la fecha del sistema: la recibe
 * como parámetro o la pide a este puerto, que se inyecta desde afuera.
 */

export interface Reloj {
  hoy(): Date;
}

/** Reloj determinista, para pruebas y para reproducir cierres históricos. */
export function relojFijo(fecha: Date): Reloj {
  const congelada = new Date(fecha.getTime());
  return {
    hoy: () => new Date(congelada.getTime()),
  };
}
