"use client";

import { SegmentedControl } from "@mantine/core";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "es" | "en";

const english: Record<string, string> = {
  "Prueba de Bartlett": "Bartlett Test",
  Experimentos: "Experiments",
  Experimento: "Experiment",
  Volver: "Back",
  "Cerrar sesión": "Sign out",
  "Este experimento no está disponible": "This experiment is not available",
  "Revisá que el enlace sea correcto o consultá a quien te lo envió.":
    "Check that the link is correct or ask the person who sent it to you.",
  Comenzar: "Start",
  Historia: "Story",
  "Terminé de leer": "I finished reading",
  Actividad: "Activity",
  "Podés continuar en {seconds} segundos.":
    "You can continue in {seconds} seconds.",
  "El intervalo terminó.": "The interval is over.",
  "Ordená los números de mayor a menor":
    "Order the numbers from highest to lowest",
  "Tocá cada número en el orden correcto.":
    "Tap each number in the correct order.",
  "Tu orden aparecerá acá": "Your order will appear here",
  "Ese orden no es correcto. Probá de nuevo.":
    "That order is incorrect. Try again.",
  "¡Orden correcto!": "Correct order!",
  Reiniciar: "Reset",
  Continuar: "Continue",
  "Reconstruí la historia": "Reconstruct the story",
  "Tu respuesta": "Your response",
  "{current} de {maximum} caracteres": "{current} of {maximum} characters",
  "Enviar respuesta": "Submit response",
  "¡Gracias por participar!": "Thank you for participating!",
  "Tu respuesta fue enviada.": "Your response was submitted.",
  Completado: "Completed",
  "Prueba de memoria": "Memory test",
  "Procesos Psicológicos Básicos": "Basic Psychological Processes",
  "Nuevo experimento": "New experiment",
  "No se pudieron cargar los experimentos.":
    "The experiments could not be loaded.",
  Participaciones: "Participations",
  "Borrador creado": "Draft created",
  "No se pudo crear el borrador": "The draft could not be created",
  "Ingresá un nombre.": "Enter a name.",
  "Ingresá la historia.": "Enter the story.",
  Publicado: "Published",
  Cerrado: "Closed",
  Borrador: "Draft",
  "Sin intervalo": "No interval",
  "Con distractor": "With distractor",
  "Sin distractor": "Without distractor",
  respuestas: "responses",
  "en curso": "in progress",
  Desde: "Since",
  corrida: "run",
  corridas: "runs",
  Último: "Latest",
  "Todavía no fue analizado": "Not analyzed yet",
  Creado: "Created",
  "Continuar configuración": "Continue setup",
  Monitorear: "Monitor",
  "Ver resultados": "View results",
  "Nombre del experimento": "Experiment name",
  "Ej. Prueba piloto": "E.g. Pilot test",
  "El texto que leerán los participantes.": "The text participants will read.",
  "Pegá la historia completa…": "Paste the full story…",
  Cancelar: "Cancel",
  "Crear borrador": "Create draft",
  "Configuración del experimento": "Experiment settings",
  "Recolección en curso": "Collection in progress",
  "Resultados del experimento": "Experiment results",
  Resumen: "Overview",
  Configuración: "Configuration",
  "La configuración queda en modo de solo lectura después de publicar.":
    "The configuration becomes read-only after publishing.",
  "Compartir experimento": "Share experiment",
  "Compartí el enlace o mostrá el código QR para sumar participantes.":
    "Share the link or show the QR code to add participants.",
  "No se pudo cargar el experimento.": "The experiment could not be loaded.",
  "Vista previa": "Preview",
  Pausa: "Pause",
  "Esperá {seconds} segundos antes de reconstruir la historia.":
    "Wait {seconds} seconds before reconstructing the story.",
  Distractor: "Distractor",
  "La actividad distractora se presentará durante este intervalo.":
    "The distractor activity will appear during this interval.",
  "Continuar vista previa": "Continue preview",
  "Tu respuesta fue completada.": "Your response was completed.",
  "Reiniciar vista previa": "Restart preview",
  Publicar: "Publish",
  "Cerrar recepción": "Close participation",
  "Ver último análisis": "View latest analysis",
  "Analizar nuevamente": "Analyze again",
  "Analizar resultados": "Analyze results",
  "No se pudo iniciar el análisis": "The analysis could not be started",
  "El análisis quedó incompleto": "The analysis was left incomplete",
  "Enlace para participantes": "Participant link",
  Copiar: "Copy",
  "Enlace copiado": "Link copied",
  "Ya podés compartirlo con participantes.":
    "You can now share it with participants.",
  "Mostrar QR": "Show QR",
  "Opciones avanzadas": "Advanced options",
  "Enlaces de difusión": "Distribution links",
  "Creá enlaces distintos para conocer desde qué grupo llegaron las respuestas.":
    "Create separate links to see which group each response came from.",
  "No se pudieron cargar los enlaces de difusión.":
    "Distribution links could not be loaded.",
  "Nombre del enlace": "Link name",
  "Ej. Familia, Trabajo, María": "E.g. Family, Work, Maria",
  "Crear enlace": "Create link",
  "Enlace de difusión creado": "Distribution link created",
  "No se pudo crear el enlace": "The link could not be created",
  Desactivar: "Disable",
  "No se pudo desactivar el enlace": "The link could not be disabled",
  "{count} respuestas": "{count} responses",
  Origen: "Source",
  "Enlace general": "General link",
  "Enlace desactivado": "Disabled link",
  "Código QR para participantes": "Participant QR code",
  "Escaneá el código para abrir el experimento.":
    "Scan the code to open the experiment.",
  "Sólo lo ven los administradores.": "Only administrators can see it.",
  "El texto se mostrará a los participantes durante la etapa de lectura.":
    "This text is shown to participants during the reading stage.",
  "Intervalo antes de reconstruir": "Interval before recall",
  "Duración en segundos. Usá 0 para pasar directamente.":
    "Duration in seconds. Use 0 to continue immediately.",
  "Usar distractor durante el intervalo":
    "Use a distractor during the interval",
  "Textos e instrucciones": "Texts and instructions",
  "Idiomas y variantes": "Languages and variants",
  "Idioma principal del contenido": "Primary content language",
  "No afecta el idioma de la interfaz administrativa.":
    "This does not affect the admin interface language.",
  "Agregar variante en otro idioma": "Add another language variant",
  "Los participantes podrán elegir esta versión antes de comenzar.":
    "Participants can choose this version before starting.",
  "Quitar variante": "Remove variant",
  "Título para participantes": "Participant title",
  Introducción: "Introduction",
  Consentimiento: "Consent",
  "Instrucciones de reconstrucción": "Recall instructions",
  "Guardar cambios": "Save changes",
  Análisis: "Analysis",
  "No se pudo cargar el análisis": "The analysis could not be loaded",
  "Revisá que corresponda a este experimento.":
    "Check that it belongs to this experiment.",
  "Análisis descriptivo": "Descriptive analysis",
  "Último análisis disponible": "Latest analysis available",
  "Completado con errores": "Completed with errors",
  "En curso": "In progress",
  Completadas: "Completed",
  Iniciadas: "Started",
  Finalización: "Completion",
  "Duración promedio": "Average duration",
  Participación: "Participation",
  completadas: "completed",
  "De {started} iniciadas · {pending} sin completar":
    "Of {started} started · {pending} incomplete",
  "Duración total promedio": "Average total duration",
  "Última actividad": "Latest activity",
  "Descargar CSV": "Download CSV",
  "Descargar planilla": "Download spreadsheet",
  Estado: "Status",
  Todas: "All",
  Todos: "All",
  Idioma: "Language",
  País: "Country",
  "Contexto de participación": "Participation context",
  "Idioma del navegador": "Browser language",
  "Zona horaria": "Time zone",
  Dispositivo: "Device",
  Navegador: "Browser",
  "Sistema operativo": "Operating system",
  Pantalla: "Screen",
  Móvil: "Mobile",
  Tablet: "Tablet",
  Escritorio: "Desktop",
  Buscar: "Search",
  "ID o texto de la respuesta": "ID or response text",
  Inicio: "Started",
  Duración: "Duration",
  Ver: "View",
  "Cargar más": "Load more",
  "No se pudieron cargar las respuestas.": "Responses could not be loaded.",
  "Todavía no hay participaciones.": "There are no participations yet.",
  "Aún no hay respuestas": "There are no responses yet",
  "El mapa de recuerdo y los fenómenos aparecerán cuando una persona complete el experimento.":
    "The memory map and phenomena will appear after someone completes the experiment.",
  "Las respuestas todavía se están analizando":
    "The responses are still being analyzed",
  "Los resultados aparecerán cuando termine el análisis automático.":
    "Results will appear when the automatic analysis is complete.",
  "No hay respuestas para estos filtros.": "No responses match these filters.",
  "Ver configuración del experimento": "View experiment configuration",
  Activado: "Enabled",
  Desactivado: "Disabled",
  "Variante en otro idioma": "Other language variant",
  "Eliminar experimento": "Delete experiment",
  "Borra también todas sus participaciones y análisis.":
    "Also deletes all of its participations and analyses.",
  Eliminar: "Delete",
  "Vas a eliminar definitivamente": "You are about to permanently delete",
  "También se borrarán todas las participaciones, respuestas y corridas de análisis asociadas. Esta acción no se puede deshacer.":
    "All associated participations, responses, and analysis runs will also be deleted. This action cannot be undone.",
  "Eliminar definitivamente": "Delete permanently",
  "Eliminar respuesta": "Delete response",
  "Borra esta participación y su análisis asociado.":
    "Deletes this participation and its associated analysis.",
  "Vas a eliminar definitivamente esta participación.":
    "You are about to permanently delete this participation.",
  "También se borrará su análisis asociado y las estadísticas globales se recalcularán. Esta acción no se puede deshacer.":
    "Its associated analysis will also be deleted and global statistics will be recalculated. This action cannot be undone.",
  "Respuesta eliminada": "Response deleted",
  "La participación y su análisis asociado fueron eliminados.":
    "The participation and its associated analysis were deleted.",
  "Compartir resultado": "Share result",
  "Generá un enlace anónimo para compartir únicamente esta comparación.":
    "Create an anonymous link that shares only this comparison.",
  "Crear enlace público": "Create public link",
  "Enlace público creado": "Public link created",
  "No se pudo crear el enlace público": "The public link could not be created",
  "Ya podés compartir este resultado.": "You can now share this result.",
  Abrir: "Open",
  "Resultado compartido": "Shared result",
  "Comparación anónima entre la historia original y una reconstrucción.":
    "Anonymous comparison between the original story and a reconstruction.",
  "Este resultado no está disponible": "This result is not available",
  "El enlace puede haber sido desactivado o ser incorrecto.":
    "The link may have been disabled or may be incorrect.",
  "Análisis automático": "Automatic analysis",
  "Las interpretaciones automáticas son orientativas y requieren revisión humana.":
    "Automatic interpretations are indicative and require human review.",
  "En preparación": "In progress",
  "El análisis todavía se está preparando. La comparación de textos ya está disponible.":
    "The analysis is still being prepared. The text comparison is already available.",
  Respuestas: "Responses",
  "Palabras de la historia": "Story words",
  "Promedio de palabras": "Average word count",
  "Extensión relativa promedio": "Average relative length",
  "Lectura promedio": "Average reading time",
  "Reconstrucción promedio": "Average recall time",
  "Mapa de recuerdo": "Memory map",
  "Explorá qué partes de la historia sobrevivieron y cómo fueron transformadas.":
    "Explore which parts of the story survived and how they were transformed.",
  Retención: "Retention",
  Transformaciones: "Transformations",
  "Unidad seleccionada": "Selected unit",
  "Retención ponderada": "Weighted retention",
  "Presente total o parcialmente": "Present in full or in part",
  "Preparación del análisis": "Analysis preparation",
  "La historia está lista para analizar respuestas.":
    "The story is ready to analyze responses.",
  "Detectá las unidades narrativas antes de publicar.":
    "Detect narrative units before publishing.",
  Lista: "Ready",
  Pendiente: "Pending",
  Analizada: "Analyzed",
  "No aplica": "Not applicable",
  "Ver unidades detectadas": "View detected units",
  "unidad detectada": "detected unit",
  "unidades detectadas": "detected units",
  "Preparar nuevamente": "Prepare again",
  "Preparar historia": "Prepare story",
  de: "of",
  "respuestas analizadas": "responses analyzed",
  Completa: "Full",
  Huella: "Trace",
  Omitida: "Omitted",
  "La respuesta conserva la idea central y sus relaciones principales.":
    "The response preserves the central idea and its main relationships.",
  "La respuesta conserva algún concepto o palabra, pero no la idea completa.":
    "The response preserves a concept or word, but not the complete idea.",
  "No hay evidencia suficiente de esta unidad en la reconstrucción.":
    "There is not enough evidence of this unit in the reconstruction.",
  "Transformaciones frecuentes": "Frequent transformations",
  "El subrayado señala las anclas conceptuales de la unidad.":
    "The underline marks the unit's conceptual anchors.",
  "No aparecen transformaciones recurrentes en esta unidad.":
    "No recurring transformations appear in this unit.",
  Sustitución: "Substitution",
  Racionalización: "Rationalization",
  Generalización: "Generalization",
  "Alta retención": "High retention",
  "Retención media": "Medium retention",
  "Baja retención": "Low retention",
  "Presenta transformaciones recurrentes": "Contains recurring transformations",
  "Fenómenos detectados": "Detected phenomena",
  "Unidad retenida": "Retained unit",
  "Omisión candidata": "Candidate omission",
  "Intrusión candidata": "Candidate intrusion",
  "Sustitución candidata": "Candidate substitution",
  "Racionalización posible": "Possible rationalization",
  "Acentuación posible": "Possible accentuation",
  "Detección automática con evidencia textual. Las interpretaciones requieren revisión humana.":
    "Automatic detection with textual evidence. Interpretations require human review.",
  "Unidades retenidas": "Retained units",
  "Omisiones candidatas": "Candidate omissions",
  "Intrusiones candidatas": "Candidate intrusions",
  "Respuestas analizadas": "Analyzed responses",
  "Seleccioná una respuesta para compararla con la historia original.":
    "Select a response to compare it with the original story.",
  "No hay respuestas completas para analizar.":
    "There are no completed responses to analyze.",
  Respuesta: "Response",
  Palabras: "Words",
  palabras: "words",
  Comparar: "Compare",
  "Extensión relativa": "Relative length",
  Lectura: "Reading",
  Reconstrucción: "Recall",
  "Tiempo total": "Total time",
  Omisiones: "Omissions",
  Intrusiones: "Intrusions",
  Retenidas: "Retained",
  "Detalle del fragmento": "Fragment details",
  "Este fragmento tiene las siguientes interpretaciones.":
    "This fragment has the following interpretations.",
  "Respuesta individual": "Individual response",
  "No se encontró la participación": "Participation not found",
  "Revisá que el enlace corresponda a este experimento.":
    "Check that the link belongs to this experiment.",
  Leyendo: "Reading",
  "En intervalo": "In interval",
  Reconstruyendo: "Reconstructing",
  Completada: "Completed",
  Recorrido: "Timeline",
  Intervalo: "Interval",
  "Intervalo / distractor": "Interval / distractor",
  Comparación: "Comparison",
  "Historia original y reconstrucción de la persona.":
    "Original story and the participant's reconstruction.",
  "Ocultar análisis": "Hide analysis",
  "Mostrar análisis": "Show analysis",
  "Historia original": "Original story",
  "La persona todavía no envió una respuesta.":
    "The participant has not submitted a response yet.",
  "Análisis asistido": "Assisted analysis",
  "Seleccioná una marca en los textos para inspeccionarla.":
    "Select a mark in the texts to inspect it.",
  Confianza: "Confidence",
  "Ingresá al espacio de administración.": "Sign in to the admin workspace.",
  "El enlace no es válido o ya venció. Pedí uno nuevo.":
    "The link is invalid or has expired. Request a new one.",
  "Continuar con Google": "Continue with Google",
  "No se pudo iniciar el acceso con Google.": "Could not start Google sign-in.",
  "o ingresá por email": "or sign in by email",
  "Enviar enlace mágico": "Send magic link",
  "El acceso está limitado a los integrantes invitados del equipo.":
    "Access is limited to invited team members.",
};

const interpolate = (
  message: string,
  values?: Record<string, string | number>,
) =>
  Object.entries(values ?? {}).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);
const storageKey = "bartlett_locale";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>("es");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem(storageKey);
      const detected =
        navigator.languages
          .map((language) => language.toLowerCase().split("-")[0])
          .find(
            (language): language is Locale =>
              language === "es" || language === "en",
          ) ?? "en";
      setLocale(saved === "es" || saved === "en" ? saved : detected);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (next) => {
        localStorage.setItem(storageKey, next);
        setLocale(next);
      },
      t: (source, values) =>
        interpolate(
          locale === "en" ? (english[source] ?? source) : source,
          values,
        ),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
};

export const LanguageSelector = ({
  compact = false,
}: {
  compact?: boolean;
}) => {
  const { locale, setLocale } = useI18n();
  return (
    <SegmentedControl
      size="xs"
      aria-label="Language / Idioma"
      value={locale}
      onChange={(value) => setLocale(value as Locale)}
      data={
        compact
          ? [
              { label: "ES", value: "es" },
              { label: "EN", value: "en" },
            ]
          : [
              { label: "Español", value: "es" },
              { label: "English", value: "en" },
            ]
      }
    />
  );
};
