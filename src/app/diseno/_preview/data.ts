import type { Signal } from "@/shared/ui/status-signal";

/**
 * Datos de muestra SOLO para la página /diseno (no existe en producción).
 * Reloj fijo: martes 10/11/2026, 10:00 a. m. (Bogotá).
 */
export const NOW = new Date("2026-11-10T15:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

export const KPIS = [
  { label: "Tareas activas", value: "33", hint: "8 vencen esta semana" },
  { label: "Cumplimiento", value: "72 %", hint: "+4 puntos vs. octubre" },
  { label: "Tareas atrasadas", value: "9", hint: "en 6 auxiliares", tone: "late" as const },
  { label: "Tickets abiertos", value: "25", hint: "19 dentro del SLA" },
  { label: "Sin asignar", value: "8", hint: "el más antiguo, hace 2 días", tone: "risk" as const },
];

export type ComplianceRow = {
  name: string;
  initials: string;
  team: string;
  signal: Signal;
  pct: number;
  done: number;
  total: number;
  next: { title: string; start: Date; due: Date };
};

export const COMPLIANCE: ComplianceRow[] = [
  {
    name: "Santiago Herrera Quintero",
    initials: "SH",
    team: "Contenidos",
    signal: "atrasada",
    pct: 40,
    done: 2,
    total: 5,
    next: { title: "Revisar accesibilidad de los PDF de Física I", start: h(-120), due: h(-26) },
  },
  {
    name: "María Camila Suárez León",
    initials: "MS",
    team: "Plataforma Moodle",
    signal: "en_riesgo",
    pct: 75,
    done: 3,
    total: 4,
    next: { title: "Configurar el calificador de Estadística I", start: h(-60), due: h(6) },
  },
  {
    name: "Juan Sebastián Ortiz Peña",
    initials: "JO",
    team: "Plataforma Moodle",
    signal: "a_tiempo",
    pct: 100,
    done: 4,
    total: 4,
    next: { title: "Respaldo de Cálculo Diferencial antes del cierre", start: h(-24), due: h(72) },
  },
  {
    name: "Paula Andrea Castro Niño",
    initials: "PC",
    team: "Contenidos",
    signal: "a_tiempo",
    pct: 83,
    done: 5,
    total: 6,
    next: { title: "Cargar los videos de la semana 6 en Inglés III", start: h(-30), due: h(50) },
  },
];

export type TicketRow = {
  code: string;
  title: string;
  category: { name: string; icon: string; color: string };
  requester: string;
  role: string;
  createdAt: Date;
  status: string;
  priority: "alta" | "media" | "baja";
  signal: Signal;
  slaDue: Date;
};

export const TICKETS: TicketRow[] = [
  {
    code: "EXP-2026-00042",
    title: "El quiz de la semana 6 no deja enviar respuestas",
    category: { name: "Errores de Moodle", icon: "bug", color: "#D64545" },
    requester: "Sandra Milena Pinzón",
    role: "Profesora",
    createdAt: h(-1.4),
    status: "Abierto",
    priority: "alta",
    signal: "en_riesgo",
    slaDue: h(0.6),
  },
  {
    code: "EXP-2026-00041",
    title: "No veo el curso de Física I en mi tablero",
    category: { name: "Acceso y matrícula", icon: "key-round", color: "#2E9E6A" },
    requester: "Kevin Alexander Parra",
    role: "Estudiante",
    createdAt: h(-5),
    status: "Asignado",
    priority: "alta",
    signal: "atrasada",
    slaDue: h(-1),
  },
  {
    code: "EXP-2026-00039",
    title: "La semana 5 no tiene el video de la clase",
    category: { name: "Lecciones sin información", icon: "file-question", color: "#E08A1E" },
    requester: "Jorge Eliécer Rangel",
    role: "Profesor",
    createdAt: h(-20),
    status: "En progreso",
    priority: "media",
    signal: "a_tiempo",
    slaDue: h(18),
  },
  {
    code: "EXP-2026-00037",
    title: "Matrícula masiva de 45 estudiantes",
    category: { name: "Solicitud al equipo de sistemas", icon: "server-cog", color: "#1673BB" },
    requester: "Diana Marcela Jaimes",
    role: "Profesora",
    createdAt: h(-28),
    status: "Respondido",
    priority: "media",
    signal: "a_tiempo",
    slaDue: h(30),
  },
];
