# E2 · Arquitectura de información y wireframes

## Mapa de navegación del sistema

El sistema se organiza en cuatro áreas según el perfil de usuario:
## Tabla de correspondencia pantalla ↔ caso de uso

| Puerto primario (P1) | Caso de uso (UML) | Pantalla (P2) |
| :--- | :--- | :--- |
| RegistrarCliente | Registrar cliente | Alta de cliente |
| SolicitarCredito | Solicitar crédito | Solicitud de crédito |
| EvaluarSolicitud | Evaluar solicitud / Aprobar / Rechazar | Bandeja del comité |
| DesembolsarCredito | Desembolsar crédito | Confirmación de desembolso |
| RegistrarPago | Registrar pago (incluye Calcular mora, Aplicar prelación, Actualizar saldo) | Registro de pago en campo |
| ConsultarCarteraEnRiesgo | Consultar cartera en riesgo (incluye Calcular cartera en riesgo) | Tablero gerencial |
| GenerarCierre | Generar cierre diario / mensual | Cierre diario / mensual |

## Jerarquía de información del tablero gerencial

El tablero muestra primero lo que la gerencia decide con más frecuencia, y cada
indicador viene con su contexto:

1. **Cartera en riesgo (7.00 %)** — el número que la gerencia mira primero cada
   mañana. Se muestra junto con lo dado por incobrable en el período (6.06 %
   tras castigar a C-005), porque el indicador baja por sí solo al castigar sin
   haber cobrado nada.

2. **Desglose por tramo** — Mora 2 (3.00 %), Mora 3 (2.25 %), Vencido (1.00 %) y
   Reestructurado al día (0.75 %). El tablero consume este desglose del núcleo,
   no lo recalcula en la interfaz.

3. **Cartera en mora (21.75 %)** — se muestra aparte y con rótulo distinto, porque
   mide algo diferente: todo crédito con al menos un día de atraso.

### Distinción visual entre cartera en mora y cartera en riesgo

- **Cartera en mora (21.75 %)** se presenta como un dato de contexto, con color
  neutro y rótulo explícito "Cartera en mora (todo atraso ≥ 1 día)".
- **Cartera en riesgo (7.00 %)** es el indicador principal, destacado, con su
  desglose por tramo y el contexto de incobrables del período.
- Nunca se rotulan igual ni se suman: son indicadores distintos que responden
  preguntas distintas.