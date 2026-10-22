# Plan de implementación

El desarrollo es local-first y se organiza en slices verticales. Infraestructura, autenticación
remota, workflows y LLM se incorporan después de validar la parte central del producto.

## Slice 0 — Bootstrap local en memoria

- Inicializar Next.js, TypeScript y tests.
- Instalar versiones exactas `1.0.0-alpha.13` de los paquetes Ontahí necesarios.
- Componer el Data Graph runtime en memoria.
- Componer el task runtime in-process, aunque todavía no haya tareas durables.
- Crear el esqueleto de la aplicación y el Runtime Protocol local.
- Configurar CI local básico: typecheck, lint y tests, sin secrets.

**No incluye:** Supabase, Vercel, deployment, workflows remotos ni API de LLM.

**Salida:** aplicación local vacía que ejecuta una Query y una Operation Ontahí contra memoria.

## Slice 1 — Grupo, identidades de desarrollo y policies

- Modelar StudyGroup, Membership y roles.
- Sembrar el único grupo y seis identidades de desarrollo.
- Implementar `DevPrincipalProvider` fail-fast fuera de development.
- Agregar un selector local de actor.
- Implementar y probar policies de owner, admin y viewer.
- Modelar AdminInvitation sin enviar emails todavía.

**Salida:** se puede cambiar de actor local y comprobar permisos reales sobre el mismo runtime.

## Slice 2 — Experimentos en borrador

- Implementar Experiment y Story.
- Crear lista de experimentos.
- Crear, editar y previsualizar un borrador.
- Implementar control de concurrencia básico.
- Mantener todo en memoria con datos seed útiles para desarrollo.

**Salida:** un admin simulado prepara el protocolo y otro puede verlo y editarlo.

## Slice 3 — Publicación y participación local

- Publicar con confirmación y token público.
- Crear ParticipantSession y credencial local de sesión.
- Implementar wizard: introducción, lectura, intervalo, distractor, reconstrucción y cierre.
- Validar tiempos y estado en el servidor.
- Permitir retomar desde el mismo navegador mientras viva el proceso.

**Salida:** una persona completa localmente el experimento sin cuenta y sin acceso a otras sesiones.

## Slice 4 — Recolección y raw data

- Mostrar contadores de sesiones.
- Listar respuestas recibidas.
- Implementar Response Inspector raw.
- Cerrar el experimento.
- Exportar CSV.
- Completar tests de estados, concurrencia y autorización.

**Salida:** el flujo funcional completo opera localmente y equivale a un formulario experimental
controlado. Éste es el primer hito de producto.

## Slice 5 — Persistencia y autenticación reales

- Crear el proyecto separado en Supabase.
- Integrar Supabase Auth SSR, magic links y principal de Ontahí. **Hecho.**
- Proteger las pantallas y Operations administrativas. **Hecho.**
- Incorporar `@ontahi/supabase` con la misma aplicación. **Hecho.**
- Crear migraciones con RLS explícito y permisos fail-closed. **Hecho.**
- Implementar invitación por email, magic links y aceptación de Membership.
- Verificar migración del flujo completo contra PostgreSQL.

**Salida:** los seis integrantes acceden por invitación y los datos sobreviven reinicios.

## Slice 6 — Primer deployment

- Crear o conectar el proyecto Vercel.
- Configurar secrets sólo en Vercel y entornos locales ignorados por Git.
- Configurar deploy previews y producción desde `main`.
- Ejecutar migraciones de manera controlada.
- Probar cookies, callbacks, redirect URLs y policies en el entorno desplegado.

**Salida:** MVP raw disponible para el grupo mediante una URL estable.

## Slice 7 — Análisis con runtime local

- Definir unidades narrativas y schema de análisis.
- Implementar FakeRecallAnalysisModel.
- Modelar AnalysisRun y RecallAnalysis.
- Implementar `Experiment.analyze` con task runtime in-process.
- Calcular métricas agregadas deterministas.
- Diseñar idempotencia por `(analysisRunId, recallId)`.

**Salida:** lifecycle de análisis completo probado localmente sin costo ni proveedor externo.

## Slice 8 — Durable workflow

- Incorporar `@ontahi/runtime-vercel-workflows`.
- Ejecutar un step idempotente por respuesta.
- Persistir y observar progreso, completion y errores parciales.
- Implementar reintento de respuestas fallidas.
- Confirmar que el cierre del navegador no interrumpe el análisis.

**Salida:** análisis durable desplegado usando el mismo contrato de Operation.

## Slice 9 — DeepSeek y evaluación

- [x] Implementar DeepSeekRecallAnalysisModel.
- [x] Validar structured output y citas de evidencia.
- [x] Registrar modelo, rúbrica, prompt y uso.
- Preparar un conjunto pequeño codificado manualmente.
- Comparar clasificación humana y automática.
- Ajustar rúbrica y tratamiento de incertidumbre.

**Salida:** análisis real con evidencia y limitaciones conocidas.

## Slice 10 — Pulido para entrega

- Revisar consentimiento, textos y datos demográficos exigidos.
- Ensayar el protocolo de punta a punta.
- Revisar accesibilidad y experiencia móvil.
- Verificar policies con tests negativos.
- Preparar demo e instrucciones para el grupo.
- Documentar metodología, resultados y líneas futuras en el informe.

## Orden de riesgos

El orden prioriza:

1. semántica y policies en un loop local rápido;
2. protocolo utilizable;
3. conservación y exportación de raw data;
4. persistencia, autenticación y seguridad de producción;
5. deployment;
6. coordinación durable;
7. calidad del análisis automático.

Crear temprano los proyectos vacíos de Supabase o Vercel es opcional y barato, pero no forma parte
del camino crítico. No se configuran secrets ni workflows hasta el slice que los utiliza.
