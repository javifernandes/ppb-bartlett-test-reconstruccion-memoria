# Evaluación aislada del análisis de reconstrucciones

Este banco prueba la clasificación semántica sin crear experimentos ni escribir en Supabase. Usa:

- una historia fija;
- 16 unidades narrativas definidas de antemano;
- reconstrucciones sintéticas con resultados humanos esperados;
- un prompt experimental que obliga al modelo a clasificar las mismas unidades en todos los casos.

Los casos cubren copia literal, paráfrasis, compresión, sustituciones convencionales, intrusiones,
negaciones, racionalizaciones y una reconstrucción coloquial.

## Ejecutar

La clave se lee de `DEEPSEEK_API_KEY` o de `.env.local`. Los resultados se escriben como JSON en
`results/`, directorio ignorado por Git.

```bash
pnpm eval:recall
```

Para ejecutar un único caso durante la iteración del prompt:

```bash
pnpm eval:recall -- --case=negation-trap
```

Para evaluar aisladamente paráfrasis y tipos de transformación mediante pares mínimos:

```bash
pnpm eval:transformations
```

## Métricas iniciales

- exactitud de la decisión binaria de recuerdo por unidad;
- precisión y exhaustividad de las transformaciones;
- coincidencia de la cantidad de intrusiones.

La rúbrica v2 separa deliberadamente el recuerdo de una unidad de sus transformaciones. Una unidad
puede considerarse recordada y, al mismo tiempo, contener una sustitución, generalización o
racionalización.

Las expectativas son una primera codificación de trabajo. Antes de usarlas en el informe deberían
ser revisadas por el grupo y, si es posible, discutidas con el docente.
