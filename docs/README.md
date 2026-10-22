# Síntesis

## Propósito

La aplicación permite reproducir una adaptación de la prueba de reconstrucción de una historia de
Bartlett con personas conocidas. El flujo preserva la respuesta original de cada participante y
ofrece un análisis automático posterior que debe interpretarse como asistencia, no como medición
psicométrica validada.

## Recorte del MVP

El MVP tendrá:

- un único grupo de estudio con seis integrantes;
- administradores incorporados exclusivamente mediante invitación por email;
- autenticación sin contraseña mediante magic link;
- creación, edición y publicación de experimentos con una única historia;
- participación anónima mediante un enlace público;
- lectura, intervalo con distractor y reconstrucción libre;
- monitoreo del proceso de recolección;
- cierre manual del experimento;
- acceso a todas las respuestas originales y exportación CSV;
- análisis durable, iniciado por un administrador después del cierre;
- análisis individual por respuesta y métricas agregadas deterministas.

El desarrollo comienza completamente local con persistencia y task runtime en memoria. Supabase,
Vercel y el proveedor LLM se incorporan después de que los flujos de experimentos, participación y
respuestas raw funcionen de punta a punta.

No tendrá registro público de administradores, creación de grupos, múltiples historias, asignación
A/B, múltiples distractores configurables ni reproducción repetida en diferentes días.

## Principios

1. **Los datos originales son la fuente de verdad.** El análisis automático nunca reemplaza la
   respuesta enviada.
2. **La autorización es fail-closed.** La aplicación no confía en defaults de Supabase ni en roles
   enviados por el navegador.
3. **Una intención de dominio es una Operation.** Las URLs representan lugares navegables; no son
   el modelo del comportamiento.
4. **El experimento guía la interfaz.** El workspace proyecta distintas vistas y acciones según el
   estado actual.
5. **El análisis es reproducible.** Cada resultado registra proveedor, modelo, versión de rúbrica y
   evidencia textual.
6. **Las capacidades avanzadas se documentan sin agrandar el MVP.**
7. **Local-first antes de infraestructura.** Persistencia, identidad y tareas se consumen mediante
   adapters reemplazables para validar primero el comportamiento.

## Mapa de documentos

- [Funcionalidad](./functionality.md): actores, casos de uso, reglas y alcance.
- [Ontología](./ontology.md): entidades, relaciones, valores, estados y Operations.
- [Arquitectura](./architecture.md): componentes, adapters, autenticación, autorización y RLS.
- [Modelo de interacción](./interaction-model.md): mapa de pantallas, CTAs y transiciones.
- [Plan de implementación](./implementation-plan.md): slices progresivos y criterios de salida.
- [Líneas futuras](./future-work.md): extensiones posibles para el informe académico.

## Preguntas todavía abiertas

- Historia e instrucciones definitivas provistas por la cátedra.
- Duración exacta del intervalo y actividad distractora.
- Rúbrica inicial de unidades narrativas y fenómenos.
- Modelo concreto de DeepSeek que se usará para el piloto.
- Datos demográficos mínimos que exige la consigna del trabajo práctico.
