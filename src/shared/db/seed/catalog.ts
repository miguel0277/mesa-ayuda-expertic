import type { TemplateField } from "../../../modules/templates/domain/template-field";
import type { BusinessHours } from "../schema/business";
import type { Priority } from "../schema/enums";

/**
 * Catálogos base. Son seguros en producción (no son datos falsos):
 * categorías de ticket (D-003), políticas de SLA y ajustes por defecto.
 */

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: "America/Bogota",
  days: [1, 2, 3, 4, 5],
  start: "07:00",
  end: "18:00",
};

/** Minutos HÁBILES por prioridad. */
export const SLA_POLICIES: { priority: Priority; firstResponse: number; resolution: number }[] = [
  { priority: "alta", firstResponse: 2 * 60, resolution: 8 * 60 },
  { priority: "media", firstResponse: 4 * 60, resolution: 24 * 60 },
  { priority: "baja", firstResponse: 8 * 60, resolution: 72 * 60 },
];

const IMAGE_OR_PDF = ["image/*", "application/pdf"];

const curso: TemplateField = {
  key: "curso",
  label: "Curso",
  type: "text",
  required: true,
  maxLength: 150,
  placeholder: "Ej.: Cálculo Diferencial – Grupo B1",
};

const enlace: TemplateField = {
  key: "enlace",
  label: "Enlace al curso o actividad",
  type: "text",
  format: "url",
  maxLength: 500,
  helpText: "Copia la dirección de la página donde está el problema.",
};

const captura: TemplateField = {
  key: "captura",
  label: "Capturas de pantalla",
  type: "file",
  accept: IMAGE_OR_PDF,
  maxFiles: 3,
  helpText: "Opcional. Imágenes o PDF, máximo 3 archivos.",
};

export type TicketTypeSeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultPriority: Priority;
  fields: TemplateField[];
};

export const TICKET_TYPES: TicketTypeSeed[] = [
  {
    slug: "errores-moodle",
    name: "Errores de Moodle",
    description:
      "Algo no funciona en la plataforma: errores, páginas que no cargan o actividades que fallan.",
    icon: "bug",
    color: "#D64545",
    defaultPriority: "alta",
    fields: [
      curso,
      enlace,
      {
        key: "navegador",
        label: "Navegador",
        type: "select",
        options: ["Chrome", "Edge", "Firefox", "Safari", "Aplicación móvil de Moodle", "Otro"],
        required: true,
      },
      {
        key: "pasos",
        label: "¿Qué estabas haciendo cuando ocurrió?",
        type: "textarea",
        required: true,
        maxLength: 2000,
      },
      captura,
    ],
  },
  {
    slug: "lecciones-sin-informacion",
    name: "Lecciones sin información",
    description:
      "Una lección, semana o recurso del curso está vacío, incompleto o con enlaces rotos.",
    icon: "file-question",
    color: "#E08A1E",
    defaultPriority: "media",
    fields: [
      curso,
      {
        key: "leccion",
        label: "Lección o semana",
        type: "text",
        required: true,
        maxLength: 150,
        placeholder: "Ej.: Semana 5 – Derivadas implícitas",
      },
      enlace,
      {
        key: "faltante",
        label: "¿Qué información falta?",
        type: "multiselect",
        options: ["Video", "Lectura o PDF", "Actividad o quiz", "Foro", "Enlace roto", "Otro"],
        required: true,
      },
      captura,
    ],
  },
  {
    slug: "preguntas-reclamos",
    name: "Preguntas y reclamos",
    description: "Dudas sobre los servicios de ExperTIC, reclamos, sugerencias o felicitaciones.",
    icon: "message-circle-question",
    color: "#7A5AF8",
    defaultPriority: "media",
    fields: [
      {
        key: "tipo",
        label: "Tipo",
        type: "select",
        options: ["Pregunta", "Reclamo", "Sugerencia", "Felicitación"],
        required: true,
      },
      { ...curso, required: false },
      {
        key: "adjunto",
        label: "Soporte",
        type: "file",
        accept: IMAGE_OR_PDF,
        maxFiles: 3,
      },
    ],
  },
  {
    slug: "solicitud-sistemas",
    name: "Solicitud al equipo de sistemas",
    description:
      "Creación de cursos, matrículas masivas, respaldos, restauraciones y configuraciones.",
    icon: "server-cog",
    color: "#1673BB",
    defaultPriority: "media",
    fields: [
      {
        key: "tipo_solicitud",
        label: "¿Qué necesitas?",
        type: "select",
        options: [
          "Creación de curso",
          "Matrícula masiva",
          "Respaldo o restauración de curso",
          "Configuración de la plataforma",
          "Otro",
        ],
        required: true,
      },
      { ...curso, required: false },
      {
        key: "fecha_requerida",
        label: "¿Para cuándo lo necesitas?",
        type: "datetime",
        required: true,
        minFromNowMinutes: 24 * 60,
        helpText: "Pide con al menos un día de anticipación.",
      },
      {
        key: "adjunto",
        label: "Archivo de apoyo (listados, formatos)",
        type: "file",
        accept: [
          ...IMAGE_OR_PDF,
          "text/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        maxFiles: 3,
      },
    ],
  },
  {
    slug: "acceso-matricula",
    name: "Acceso y matrícula a cursos",
    description:
      "No puedes entrar a la plataforma, no ves tu curso o tienes problemas con tu matrícula.",
    icon: "key-round",
    color: "#2E9E6A",
    defaultPriority: "alta",
    fields: [
      {
        key: "plataforma",
        label: "Plataforma",
        type: "select",
        options: ["Moodle", "Correo institucional", "Otra"],
        required: true,
      },
      {
        key: "problema",
        label: "¿Qué te pasa?",
        type: "select",
        options: [
          "No puedo iniciar sesión",
          "No veo mi curso",
          "Olvidé mi contraseña",
          "Estoy en el grupo equivocado",
          "Otro",
        ],
        required: true,
      },
      { ...curso, required: false },
      {
        key: "codigo",
        label: "Código UIS",
        type: "text",
        maxLength: 20,
        placeholder: "Ej.: 2201234",
      },
      captura,
    ],
  },
  {
    slug: "otra-solicitud",
    name: "Otra solicitud",
    description: "Cualquier otra solicitud de soporte que no encaje en las categorías anteriores.",
    icon: "circle-help",
    color: "#64748B",
    defaultPriority: "baja",
    fields: [
      {
        key: "adjunto",
        label: "Adjuntos",
        type: "file",
        accept: [...IMAGE_OR_PDF, "application/zip"],
        maxFiles: 5,
      },
    ],
  },
];
