# Reconstrucción de memoria — prueba de Bartlett

Aplicación para ejecutar una adaptación académica de la prueba de reconstrucción de una historia
de Bartlett. Un grupo de administradores crea y publica experimentos, comparte un enlace con
participantes y, una vez cerrada la recolección, consulta respuestas originales y análisis
asistidos por un modelo de lenguaje.

El proyecto es un trabajo práctico de Procesos Psicológicos Básicos y, al mismo tiempo, una prueba
de aplicación de Ontahí.

## Documentación

La [síntesis del producto](./docs/README.md) describe el alcance y enlaza las especificaciones:

- [Funcionalidad](./docs/functionality.md)
- [Ontología](./docs/ontology.md)
- [Arquitectura, stack y seguridad](./docs/architecture.md)
- [Modelo de interacción](./docs/interaction-model.md)
- [Plan de implementación](./docs/implementation-plan.md)
- [Líneas futuras](./docs/future-work.md)

## Estado

Slice 0 ejecutable en local:

- Next.js 16, React 19 y Mantine 9;
- Ontahí `1.0.0-alpha.13`, fijado explícitamente;
- persistencia en memoria con un experimento de ejemplo;
- creación y edición de experimentos en borrador a través del bridge de Ontahí;
- sin autenticación, servicios externos ni deployment todavía.

## Desarrollo local

Requiere Node.js 20.9 o superior y pnpm 10.

```bash
pnpm install
pnpm dev
```

La aplicación queda disponible en `http://localhost:3000`. Para ejecutar todos los chequeos:

```bash
pnpm verify
```
