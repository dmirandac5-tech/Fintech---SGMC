# E1 · Investigación de usuario
-------------------------------------------------------------------------------------------------------------------
## Persona 1 · Asesor de crédito
-------------------------------------------------------------------------------------------------------------------
| Campo | Contenido |
| :--- | :--- |
| **Nombre** | Marco Tulio Ramírez |
| **Rol y contexto** | Asesor de crédito de Crédito Vecino. Visita 8–12 clientes al día en campo, captura datos en cada visita. |
| **Dispositivo y conectividad** | Teléfono Android de gama media. Señal intermitente o nula en zonas rurales. |
| **Objetivos** | "Capturar la solicitud y el pago del cliente rápido, sin equivocarme, y que el sistema no me borre lo que ya tecleé." |
| **Frustraciones** | La app pierde la sesión al quedarse sin señal y debe recapturar el DPI del cliente desde cero. |
| **Alfabetización digital** | Usa WhatsApp y redes sociales con soltura, pero no está familiarizado con formularios financieros complejos. |
| **Relación con la mora** | Entiende que la mora crece con los días, pero no conoce el detalle por tramos. |
| **Cita representativa** | "Si pierdo la señal, no quiero volver a teclear todo. Eso me quita tiempo y el cliente se molesta." |

-------------------------------------------------------------------------------------------------------------------
## Persona 2 · Cliente
-------------------------------------------------------------------------------------------------------------------
| Campo | Contenido |
| :--- | :--- |
| **Nombre** | Doña Rosa Chacón |
| **Rol y contexto** | Dueña de un puesto de venta de comida en el mercado. Cliente de microcrédito. |
| **Dispositivo y conectividad** | Teléfono básico con datos limitados. No siempre tiene internet. |
| **Objetivos** | "Saber cuánto debo, cuándo pago y cuánto me queda. No quiero sorpresas." |
| **Frustraciones** | No entiende los avisos de mora ni por qué sube. Desconfía de lo que no comprende. |
| **Alfabetización digital** | Baja. Usa el teléfono para llamar y WhatsApp, poco más. |
| **Relación con la mora** | Sabe que si se atrasa "le cobran más", pero no entiende por qué a veces sube más rápido que otras. |
| **Cita representativa** | "Solo quiero que me digan cuánto debo y cuándo. Si me explican bien, pago sin problema." |

-------------------------------------------------------------------------------------------------------------------
## Persona 3 · Gerencia / comité
-------------------------------------------------------------------------------------------------------------------
| Campo | Contenido |
| :--- | :--- |
| **Nombre** | Lic. Ana Lucía Monterroso |
| **Rol y contexto** | Gerente de cartera. Toma decisiones con cifras agregadas en oficina, pantalla grande. |
| **Dispositivo y conectividad** | Computadora de escritorio con conexión estable. |
| **Objetivos** | "Ver en segundos qué parte de la cartera está en riesgo y qué se dio por incobrable en el período." |
| **Frustraciones** | Los reportes mezclan cartera en mora con cartera en riesgo, y decide sobre el número equivocado. |
| **Alfabetización digital** | Alta. Usa Excel, dashboards y herramientas de BI. |
| **Relación con la mora** | Necesita el desglose por tramo y el contexto (incobrables del período), no solo un porcentaje. |
| **Cita representativa** | "Necesito el número correcto a la primera. Si el tablero me confunde, tomo la decisión equivocada." |


-------------------------------------------------------------------------------------------------------------------
## Journey map — flujo principal
-------------------------------------------------------------------------------------------------------------------
Flujo: solicitud de crédito → aprobación → desembolso → primera cuota.

| Etapa | Acciones del usuario | Emoción | Punto de dolor |
| :--- | :--- | :--- | :--- |
| 1. Solicitud | El asesor captura datos del cliente en campo, de pie y con una mano. | Tensión | La app pierde la sesión al quedarse sin señal y hay que recapturar el DPI desde cero. |
| 2. Simulación | El asesor ingresa monto y plazo; el sistema muestra el plan de amortización. | Alivio | Si el campo de monto es ambiguo, se captura un monto equivocado que cambia todo el plan. |
| 3. Aprobación | El comité evalúa la solicitud en la bandeja. | Espera | El asesor no recibe ninguna notificación; debe volver a revisar la bandeja manualmente para saber si la solicitud fue aprobada o rechazada. |
| 4. Desembolso | Se confirma el desembolso y se genera el plan definitivo. | Satisfacción | Si no hay confirmación explícita del monto, un error de captura pasa al contrato. |
| 5. Primera cuota | El cliente paga; el sistema aplica la prelación (gastos → mora → interés → capital). | Confusión | El cliente no entiende a qué se aplicó su pago si el desglose no se muestra con claridad. |


-------------------------------------------------------------------------------------------------------------------
## Momentos críticos donde un error de interfaz produce un error de dinero
-------------------------------------------------------------------------------------------------------------------
1. **Captura del monto en la solicitud** — Si el campo de monto es ambiguo o no valida el rango
   (Q1,000–Q25,000), el asesor puede teclear un monto equivocado que altera todo el plan de
   amortización y el contrato.

2. **Registro de pago sin señal** — Si el asesor registra un pago sin conexión y la app reintenta
   al reconectar, sin la clave de idempotencia el cliente podría ser cobrado dos veces por el
   mismo pago.

3. **Desglose de la prelación de pago** — Si el comprobante no muestra cuánto fue a gastos,
   cuánto a mora, cuánto a interés y cuánto a capital, el cliente no puede verificar su pago
   y la institución no puede auditar el movimiento.

4. **El cliente descubre que su mora subió de tramo** — El momento en que el cliente se entera
   de que su mora creció más rápido (por el cambio de tramo) es crítico: si se entera después
   y por un canal confuso, percibe la mora como una multa arbitraria. La interfaz debe
   explicar el desglose por tramos ANTES de que ocurra, en lenguaje llano.