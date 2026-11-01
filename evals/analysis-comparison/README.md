# Comparador local de análisis

Genera un HTML para comparar el analizador actual por unidades (v1) con el analizador experimental
por hechos atómicos (v2). No importa código de persistencia ni escribe en Supabase.

```bash
pnpm eval:compare-analysis -- \
  --csv="/ruta/La canasta del río.csv" \
  --session=90465b78-2afb-4d54-b434-1495b65757f2
```

Por omisión usa la última rúbrica v2 generada en `../story-preparation-v2/results/`. Los JSON y
HTML producidos se guardan en `results/`, ignorado por Git.
