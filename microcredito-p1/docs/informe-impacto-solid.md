# Informe de impacto SOLID — E6

**Proyecto:** Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.
**Curso:** Análisis de Sistemas II (037)
**Equipo:** Daniel Alexander Miranda Castillo, Melany Romero Samayoa, Walter Yair Ramos Carreto, Astrid Jasmín López Medinilla
**Fecha:** 22 de septiembre de 2026

---

## 1. Punto de partida

| Entrega | Hash / etiqueta |
| :--- | :--- |
| Proyecto 1 | `entrega-p1` (commit `567d089`) |
| Proyecto 2 | `aa644b7` |

---

## 2. Métricas del cambio

El cambio aplicado es el de la sección 7 del enunciado: política de mora escalonada por tramo de atraso (CP-01), gasto de gestión de cobro (CP-02), coexistencia de políticas (CP-03) y correcciones CP-04. Medición limitada a `src/dominio/`, entre el commit de entrega del P1 y el del P2.

| Métrica | Valor | Lectura |
| :--- | :--- | :--- |
| Archivos del núcleo creados | 6 | Bueno: la funcionalidad nueva vive en archivos nuevos |
| Archivos del núcleo modificados |  ́0 | Excelente: objetivo razonable ≤ 2; aquí 0 |
| ¿Se modificó el motor de cálculo de mora? | **No** | El principio abierto/cerrado se cumplió |
| Pruebas del P1 que dejaron de pasar |  ́0 | La suite completa sigue en verde |
| Pruebas del P1 que hubo que reescribir |  ́0 | Ninguna regresión |
| Líneas netas añadidas al núcleo | +289 |  ́6 archivos nuevos, todos de política; el motor intacto |

**Diff respaldatorio:**

Copiar
git diff --stat entrega-p1 -- src/dominio/ .../dominio/politica-mora/catalogo-politicas.ts | 44 ++++++ .../dominio/politica-mora/clasificacion-tramo.ts | 72 ++++++++++ .../dominio/politica-mora/gasto-gestion-cobro.ts | 37 +++++++ .../dominio/politica-mora/politica-escalonada.ts | 66 ++++++++++ .../dominio/politica-mora/politica-plana.ts | 38 +++++++ .../dominio/politica-mora/politica-retroactiva.ts | 32 +++++++ 6 files changed, 289 insertions(+)


---

## 3. Los cinco principios, uno por uno

### S — Responsabilidad única

**Pregunta:** ¿Quién decide en qué tramo está una cuota, y quién decide cuánto cuesta ese tramo? ¿Son la misma clase?

**Respuesta:** No. Son piezas separadas y probadas por separado:

- `src/dominio/politica-mora/clasificacion-tramo.ts` — la **Specification** que clasifica días de atraso → tramo (`clasificarTramo()`, `diasEnTramo()`). Una sola responsabilidad: decidir el tramo.
- `src/dominio/politica-mora/politica-escalonada.ts` — la **tabla de tasas** por tramo (`TNA_MORATORIA_POR_TRAMO`) y el cálculo (`calcularMoratorioEscalonado()`). Otra responsabilidad: cuánto cuesta cada tramo.



### O — Abierto/cerrado

**Pregunta:** ¿Pudo agregar la política escalonada sin abrir el motor de cálculo?

**Respuesta:** **Sí.** El diff muestra que `calculadora-mora.ts` **no aparece** en los archivos modificados. La política nueva se agregó en archivos nuevos bajo `politica-mora/`, sin tocar el motor. El motor sigue recibiendo la política inyectada vía `PoliticaCredito` (como en el P1)y resolviendo la tasa con `tasaMoratoriaDiaria(politica)`. Para admitir una política nueva, solo se añade un archivo nuevo — el motor no cambia.



### L — Sustitución de Liskov

**Pregunta:** ¿Puede intercambiar la política plana, la escalonada y la retroactiva sin que ninguna rompa los invariantes del motor?

**Respuesta:** **Sí.** El archivo `tests/contrato-politica.test.ts` ejecuta la **misma batería de pruebas de contrato** contra las tres implementaciones (`politica-plana`, `politica-escalonada`, `politica-retroactiva`). Las tres aceptan los mismos casos válidos (días y capital no negativos, devuelven cero para cero días o capital cero), no devuelven mora negativa ni que exceda el capital, y la mora es monótona creciente. Ninguna implementación rompe los invariantes del motor ni lanza "no soportado".



### I — Segregación de interfaces

**Pregunta:** ¿El puerto de política de mora expone solo lo que el motor necesita, o arrastra métodos que ninguna implementación usa?

**Respuesta:** La interfaz es mínima. Cada política expone exactamente lo que el motor necesita para calcular la tasa diaria y el moratorio. Ninguna implementación lanza "no soportado" ni tiene métodos muertos. La interfaz cabe en pocas líneas y todas las implementaciones la cumplen por completo.



### D — Inversión de dependencias

**Pregunta:** ¿El motor depende de la abstracción de política, o de una implementación concreta?

**Respuesta:** De la abstracción. El motor (`calculadora-mora.ts`) recibe la `PoliticaCredito` **inyectada** como parámetro — no la construye ni la importa por nombre concreto. La elección de qué política aplica según la fecha de otorgamiento se resuelve en `catalogo-politicas.ts` (`politicaMoraParaCredito(fechaOtorgamiento)`), que devuelve la política adecuada. El motor no sabe ni le importa cuál implementación concreta es: solo depende de la abstracción.



---

## 4. Puntos de fricción

**No hubo ninguno.** El diff (`git diff --stat entrega-p1 -- src/dominio/`) muestra que **ningún archivo existente del núcleo fue abierto ni modificado**. La funcionalidad nueva (política escalonada, clasificación por tramo, gasto de gestión de cobro, catálogo de políticas) vive íntegramente en archivos nuevos bajo `src/dominio/politica-mora/`. El motor de cálculo de mora (`calculadora-mora.ts`), el plan de amortización, la prelación de pagos y el modelo de estados quedaron intactos.

.

Esto confirma que el diseño del Proyecto 1 ya había aplicado el patrón Strategy con parámetros versionados (sección 6.3.1 del enunciado del P1): la política es una dependencia inyectada, no una constante ni un `if` en el motor.



---

## 5. Resultado de las pruebas

Salida de `npm test` (que ejecuta `tsc --noEmit && vitest run`):

Copiar
Test Files 12 passed (12) Tests 230 passed (230)


Desglose de lo verificado:

- **Casos M-1 a M-5** (`tests/politica-mora.test.ts`): Q5.44, Q18.14, Q50.80, Q65.32, Q1,047.76 — todos reproducidos exactamente.

- **Coexistencia de políticas CP-03**: Q21.77 con la plana (crédito anterior al 1 oct 2026) y Q18.14 con la escalonada, para la misma cuota y los mismos 45 días.

- **Suite completa del P1 intacta**: la prueba de los Q7.26 a 15 días y la tabla de amortización de 12 filas siguen pasando sin modificarse. **0 pruebas reescritas, 0 regresiones.**
- **Prueba de contrato contra las tres políticas** (`tests/contrato-politica.test.ts`): sustitución de Liskov verificada.
.
- **Invariantes de la sección 7.9**: mora monótona, escalonada ≤ retroactiva, mora nunca excede el capital, equivalencia en el primer tramo, incobrable deja de generar moratorio. Todos verificados.



- **CP-04.1**: transición `en_mora → cancelado` verificada (`tests/cp04.test.ts`); sigue siendo imposible pagar un crédito `SOLICITADO`.
- **CP-04.2**: suspensión del devengo a los 90 días verificada (`debeSuspenderDevengo()`); el umbral es 90 y a partir del día 91 se suspende.
.
- **CP-04.3**: desglose de cartera en riesgo por tramo (`tests/cartera-por-tramo.test.ts`): 3.00 % + 2.25 % +  ́1.00 % +  ́0.75 % =  ́7.00 %, y baja a  ́6.06 % al dar por incobrable a C-005.



---

## 6. Conclusión

El cambio de requisito (política de mora escalonada por tramo) fue absorbido **sin modificar ni una línea del motor de cálculo**. Las métricas lo respaldan:

- **6 archivos creados, 0 modificados** en el núcleo.
- **0 pruebas del P1 reescritas, 0 regresiones.**
- El motor de mora (`calculadora-mora.ts`) **no aparece en el diff**.

Esto demuestra que el diseño del Proyecto 1 cumplía efectivamente los principios SOLID que declaraba: el patrón Strategy con parámetros versionados (sección 6.3.1 del P1) permitió que la política escalonada se agregara como un archivo nuevo, sin abrir el motor. La Inversión de Dependencias y el Abierto/Cerrado no eran afirmaciones de documento: son verificables en el repositorio.



**Qué se haría distinto hoy:** el diseño ya era correcto. La única mejora posible sería documentar desde el P1 la ubicación prevista para políticas nuevas (la carpeta `politica-mora/`), para que la evolución fuera aún más evidente para quien lea el repositorio por primera vez. En lo esencial, el diseño del P1 sobrevivió intacto al cambio — que era exactamente el objetivo del Proyecto 2.