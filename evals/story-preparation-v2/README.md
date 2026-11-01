# Preparación semántica v2 de la historia

Este laboratorio prueba una rúbrica más fina sin modificar entidades, Supabase ni los análisis
existentes. DeepSeek recibe la historia original y devuelve:

- unidades narrativas literales para facilitar la navegación;
- hechos atómicos evaluables por separado;
- importancia de cada hecho (`backbone`, `supporting` o `detail`);
- tipo semántico y dependencias mínimas entre hechos.

Los resultados se escriben en `results/`, que está ignorado por Git. Cada ejecución crea un
archivo nuevo y nunca sobreescribe otra rúbrica.

## Ejecutar

La clave se lee de `DEEPSEEK_API_KEY` o de `.env.local`.

```bash
pnpm eval:prepare-story-v2
```

Para preparar otra historia:

```bash
pnpm eval:prepare-story-v2 -- --story=/ruta/historia.txt --language=es
```

Esta etapa no analiza respuestas. Primero hay que revisar humanamente la rúbrica generada; recién
después se usa como entrada del analizador de reconstrucciones v2.
