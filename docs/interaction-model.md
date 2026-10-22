# Modelo de interacción

## Estructura principal

La aplicación administrativa se divide en tres niveles:

```text
Experiment List
    ↓ selecciona contexto
Experiment Workspace
    ↓ selecciona una participación
Response Inspector
```

- **Experiment List:** elegir o crear un experimento.
- **Experiment Workspace:** comprender su estado actual y ejecutar la próxima acción válida.
- **Response Inspector:** examinar una respuesta y su análisis sin perder el contexto.

## Mapa administrativo

```mermaid
flowchart TD
    Login[Iniciar sesión por magic link] --> List[Lista de experimentos]
    List -->|Nuevo experimento| Create[Crear experimento]
    List -->|Abrir experimento| Workspace[Experiment Workspace]
    List -->|Integrantes| Members[Integrantes]

    Members -->|Invitar integrante| Invite[Invitación por email]
    Invite -->|Enviar| Members

    Create -->|Guardar borrador| Draft[Workspace · Borrador]
    Draft -->|Editar| Edit[Editar configuración]
    Edit -->|Guardar| Draft
    Draft -->|Vista previa| Preview[Preview del participante]
    Preview -->|Volver| Draft
    Draft -->|Publicar| Publish{Confirmar publicación}
    Publish -->|Confirmar| Gathering[Workspace · Recolección]

    Gathering -->|Copiar enlace| Gathering
    Gathering -->|Ver respuestas| Responses[Respuestas raw]
    Responses -->|Seleccionar| Inspector[Response Inspector]
    Inspector -->|Volver| Responses
    Gathering -->|Cerrar| Close{Confirmar cierre}
    Close -->|Confirmar| Closed[Workspace · Cerrado]

    Closed -->|Ejecutar análisis| Running[Workspace · Analizando]
    Running -->|Observar TaskRun| Running
    Running -->|Completado| Results[Workspace · Resultados]
    Running -->|Errores parciales| Partial[Resultados parciales]
    Partial -->|Reintentar fallidas| Running

    Results -->|Resumen| Summary[Métricas agregadas]
    Results -->|Respuestas raw| Responses
    Results -->|Seleccionar| Analyzed[Response Inspector + análisis]
    Results -->|Descargar CSV| Export[Exportación]
```

## Proyección del workspace por estado

| Estado                 | Información principal       | CTA principal       | Acciones secundarias          |
| ---------------------- | --------------------------- | ------------------- | ----------------------------- |
| `draft`                | Configuración del protocolo | Publicar            | Editar, previsualizar         |
| `published`            | Progreso de recolección     | Cerrar recepción    | Copiar enlace, ver respuestas |
| `closed`               | Totales finales y raw data  | Ejecutar análisis   | Descargar CSV                 |
| `analyzing`            | Progreso durable            | Ninguno             | Ver respuestas                |
| `analyzed`             | Métricas y conclusiones     | Ver resultados      | Descargar, nueva corrida      |
| `analyzed_with_errors` | Resultados y fallas         | Reintentar fallidas | Ver resultados disponibles    |

## Flujo del participante

```mermaid
flowchart LR
    Link[Abrir enlace] --> Intro[Introducción y consentimiento]
    Intro -->|Comenzar| Read[Leer historia]
    Read -->|Terminé de leer| Wait[Intervalo y distractor]
    Wait -->|Tiempo cumplido| Recall[Reconstrucción libre]
    Recall -->|Enviar respuesta| Done[Confirmación]

    Link -. experimento cerrado .-> Unavailable[No disponible]
    Link -. sesión existente .-> Resume[Retomar sesión]
    Resume --> Read
    Resume --> Wait
    Resume --> Recall
```

## CTA dominante

Cada vista tiene una única acción dominante:

```text
Lista              → Nuevo experimento
Crear/editar       → Guardar borrador
Borrador           → Publicar
Publicado          → Cerrar recepción
Cerrado            → Ejecutar análisis
Analizando         → observar, sin nueva acción dominante
Analizado          → Ver resultados
Introducción       → Comenzar
Lectura            → Terminé de leer
Intervalo          → habilitación automática
Reconstrucción     → Enviar respuesta
```

## Consideraciones de concurrencia

Como seis admins pueden abrir el mismo experimento:

- cada mutación valida el estado actual en el servidor;
- publicar o cerrar dos veces produce un rechazo convencional, no una segunda transición;
- la UI refresca el workspace después de una Operation;
- inicialmente no se ofrece edición colaborativa en tiempo real;
- `updatedAt` o una versión permiten detectar edición sobre un borrador desactualizado.
