# Funcionalidad

## Actores

### Owner

Integra el único grupo de estudio. Puede administrar integrantes y realizar todas las acciones de
un administrador.

### Admin

Puede crear, editar, publicar, monitorear, cerrar y analizar cualquier experimento del grupo.

### Viewer

Puede consultar experimentos, respuestas y resultados, pero no modificarlos. Este rol permite
invitar posteriormente al profesor sin darle acceso de escritura.

### Participante

Accede sin cuenta mediante el enlace público de un experimento. Su autoridad queda limitada a la
sesión anónima creada para ese navegador.

## Casos de uso del grupo

### Administrar integrantes

- Invitar un email como admin o viewer.
- Consultar invitaciones pendientes e integrantes activos.
- Reenviar o revocar una invitación.
- Revocar el acceso de un integrante.

No existe registro público ni solicitud para unirse. Las memberships se crean sólo al aceptar una
invitación válida para el mismo email autenticado.

### Crear un experimento

El admin define:

- nombre interno;
- título e introducción visibles para participantes;
- consentimiento;
- historia;
- instrucciones de lectura y reconstrucción;
- duración del intervalo;
- distractor habilitado o deshabilitado.

El experimento se guarda inicialmente como borrador.

### Editar y previsualizar

Mientras permanece en borrador, un admin puede modificarlo y recorrer una vista previa del flujo
del participante. Después de publicarlo, el contenido que afecta el protocolo queda inmutable.

### Publicar

La publicación genera o habilita un enlace público no enumerable. Desde ese momento se aceptan
nuevas sesiones de participantes.

### Monitorear la recolección

El workspace muestra cantidades de sesiones iniciadas, en curso, completadas y abandonadas. Los
admins pueden consultar respuestas ya enviadas sin cerrar la recepción.

### Cerrar

El cierre impide nuevas sesiones y nuevos envíos. Es una transición explícita con confirmación.

### Analizar

Un admin inicia una corrida durable después del cierre. El sistema analiza cada respuesta de manera
independiente, persiste progreso y errores, y calcula las métricas agregadas mediante código.

### Consultar y exportar resultados

- Ver resumen agregado.
- Ver fenómenos candidatos con evidencia.
- Consultar respuestas originales.
- Abrir el análisis de una respuesta.
- Descargar respuestas y métricas en CSV.
- Reintentar análisis fallidos.

## Casos de uso del participante

1. Abrir el enlace público.
2. Leer información y aceptar el consentimiento.
3. Comenzar una sesión anónima.
4. Leer la historia una sola vez.
5. Completar el intervalo y distractor.
6. Reconstruir libremente la historia.
7. Enviar la respuesta.
8. Recibir confirmación.

Una cookie segura permite retomar una sesión incompleta desde el mismo navegador. El MVP no busca
impedir de manera absoluta participaciones duplicadas desde otros navegadores.

## Análisis inicial

Las primeras métricas candidatas son:

- cantidad de palabras y extensión relativa;
- unidades narrativas retenidas;
- unidades narrativas omitidas;
- intrusiones;
- sustituciones;
- posibles normalizaciones, marcadas como interpretación asistida.

Toda clasificación automática debe incluir evidencia de la historia y de la respuesta, nivel de
confianza y versión de rúbrica. Racionalización y acentuación no se presentan como hechos objetivos.

La implementación local inicial usa una heurística léxica versionada para validar el lifecycle de
análisis, la evidencia y las agregaciones. Sus omisiones e intrusiones son candidatos para revisión
humana, no resultados equivalentes a una codificación experta. El adapter de modelo reemplazará esta
heurística sin cambiar el contrato persistido ni las pantallas.

## Fuera del MVP

- Registro público de administradores.
- Múltiples grupos de estudio.
- Permisos particulares por experimento.
- Variantes A/B de historias.
- Asignación aleatoria entre condiciones.
- Biblioteca de distractores.
- Reproducción serial.
- Reproducciones diferidas de la misma persona.
- Prevención fuerte de duplicados.
- Edición manual completa de las clasificaciones automáticas.
