import type { Role, UserStatus } from "../schema/enums";

/** Datos de demostración. SOLO para desarrollo y pruebas (nunca en producción). */

export const DEMO_EMAIL_DOMAIN = "expertic.test";
export const DEMO_PASSWORD = "ExperTIC-2026*";

export type DemoUser = {
  key: string;
  name: string;
  role: Role;
  status?: UserStatus;
  codigoUis?: string;
  programa?: string;
  telefono?: string;
};

export const DEMO_USERS: DemoUser[] = [
  { key: "docente", name: "Carolina Méndez Rueda", role: "docente", telefono: "3001234567" },

  {
    key: "lider1",
    name: "Andrés Felipe Gómez Pardo",
    role: "lider",
    codigoUis: "2191045",
    programa: "Ingeniería de Sistemas",
  },
  {
    key: "lider2",
    name: "Laura Valentina Rojas Díaz",
    role: "lider",
    codigoUis: "2190877",
    programa: "Ingeniería de Sistemas",
  },

  {
    key: "aux1",
    name: "Juan Sebastián Ortiz Peña",
    role: "auxiliar",
    codigoUis: "2211532",
    programa: "Ingeniería de Sistemas",
  },
  {
    key: "aux2",
    name: "María Camila Suárez León",
    role: "auxiliar",
    codigoUis: "2212088",
    programa: "Ingeniería Industrial",
  },
  {
    key: "aux3",
    name: "Daniel Esteban Vargas Ruiz",
    role: "auxiliar",
    codigoUis: "2200761",
    programa: "Ingeniería Electrónica",
  },
  {
    key: "aux4",
    name: "Paula Andrea Castro Niño",
    role: "auxiliar",
    codigoUis: "2213450",
    programa: "Licenciatura en Matemáticas",
  },
  {
    key: "aux5",
    name: "Santiago Herrera Quintero",
    role: "auxiliar",
    codigoUis: "2201999",
    programa: "Diseño Industrial",
  },
  {
    key: "aux6",
    name: "Valentina Moreno Acevedo",
    role: "auxiliar",
    codigoUis: "2214120",
    programa: "Ingeniería de Sistemas",
  },

  {
    key: "profesor1",
    name: "Jorge Eliécer Rangel Torres",
    role: "profesor",
    programa: "Escuela de Matemáticas",
  },
  {
    key: "profesor2",
    name: "Sandra Milena Pinzón Ardila",
    role: "profesor",
    programa: "Escuela de Física",
  },
  {
    key: "profesor3",
    name: "Hernando Blanco Serrano",
    role: "profesor",
    programa: "Escuela de Ingeniería de Sistemas",
  },
  {
    key: "profesor4",
    name: "Diana Marcela Jaimes Prada",
    role: "profesor",
    programa: "Escuela de Idiomas",
  },
  {
    key: "profesor5",
    name: "Óscar Iván Mantilla Cruz",
    role: "profesor",
    programa: "Escuela de Estudios Industriales",
    status: "pendiente",
  },

  {
    key: "estudiante1",
    name: "Natalia Sofía Duarte Gil",
    role: "estudiante",
    codigoUis: "2231001",
    programa: "Ingeniería Civil",
  },
  {
    key: "estudiante2",
    name: "Kevin Alexander Parra Silva",
    role: "estudiante",
    codigoUis: "2231187",
    programa: "Ingeniería Mecánica",
  },
  {
    key: "estudiante3",
    name: "Isabella Rueda Carvajal",
    role: "estudiante",
    codigoUis: "2232045",
    programa: "Medicina",
  },
  {
    key: "estudiante4",
    name: "Mateo Andrés Galvis Ríos",
    role: "estudiante",
    codigoUis: "2240312",
    programa: "Ingeniería de Sistemas",
  },
  {
    key: "estudiante5",
    name: "Juliana Prieto Arenas",
    role: "estudiante",
    codigoUis: "2240589",
    programa: "Derecho",
  },
  {
    key: "estudiante6",
    name: "Samuel David Cáceres Mejía",
    role: "estudiante",
    codigoUis: "2221740",
    programa: "Física",
  },
  {
    key: "estudiante7",
    name: "Mariana Lizarazo Toloza",
    role: "estudiante",
    codigoUis: "2222011",
    programa: "Trabajo Social",
  },
  {
    key: "estudiante8",
    name: "Tomás Felipe Sanabria Ortiz",
    role: "estudiante",
    codigoUis: "2241176",
    programa: "Economía",
  },
  {
    key: "estudiante9",
    name: "Gabriela Ochoa Florez",
    role: "estudiante",
    codigoUis: "2233350",
    programa: "Enfermería",
  },
  {
    key: "estudiante10",
    name: "Nicolás Bautista Peña",
    role: "estudiante",
    codigoUis: "2242210",
    programa: "Química",
    status: "pendiente",
  },
];

export const DEMO_TEAMS = [
  {
    key: "moodle",
    name: "Equipo Plataforma Moodle",
    lider: "lider1",
    members: ["aux1", "aux2", "aux3"],
  },
  {
    key: "contenidos",
    name: "Equipo Contenidos Virtuales",
    lider: "lider2",
    members: ["aux4", "aux5", "aux6"],
  },
] as const;

export const CURRENT_SEMESTER = "2026-2";
export const PREVIOUS_SEMESTER = "2026-1";

export const COURSES = [
  "Cálculo Diferencial – Grupo B1",
  "Física I – Grupo H2",
  "Programación Orientada a Objetos – Grupo O1",
  "Inglés III (virtual)",
  "Estadística I – Grupo E3",
  "Diplomado en Docencia Virtual",
  "Gestión de Proyectos TIC",
  "Álgebra Lineal – Grupo A4",
  "Química General – Grupo Q1",
  "Cátedra UIS (virtual)",
];

/** Títulos y descripciones de ejemplo por categoría (slug). */
export const TICKET_SAMPLES: Record<string, { title: string; description: string }[]> = {
  "errores-moodle": [
    {
      title: "El quiz de la semana 6 no deja enviar respuestas",
      description:
        "Al dar clic en «Terminar intento» aparece un error y se pierden las respuestas.",
    },
    {
      title: "Error al subir tareas en formato PDF",
      description:
        "Los estudiantes reportan que el botón de subir archivo no responde desde el celular.",
    },
    {
      title: "El libro de calificaciones muestra notas en cero",
      description: "Las notas del parcial ya estaban calificadas y ahora aparecen en 0.",
    },
    {
      title: "La página del curso carga en blanco",
      description: "Desde ayer el curso queda en blanco después de iniciar sesión.",
    },
    {
      title: "El foro no envía notificaciones",
      description: "Los estudiantes no reciben el correo cuando publico en el foro de novedades.",
    },
  ],
  "lecciones-sin-informacion": [
    {
      title: "La semana 5 no tiene el video de la clase",
      description: "La lección aparece vacía; solo está el título.",
    },
    {
      title: "Enlace roto en la lectura complementaria",
      description: "El PDF de la unidad 3 da error 404.",
    },
    {
      title: "Falta el material de la unidad de integrales",
      description: "No aparece la guía ni los ejercicios propuestos.",
    },
    {
      title: "El cuestionario de práctica no tiene preguntas",
      description: "El quiz se abre pero no muestra ninguna pregunta.",
    },
  ],
  "preguntas-reclamos": [
    {
      title: "¿Cómo solicito un curso virtual para el próximo semestre?",
      description: "Quisiera saber los pasos y las fechas para pedir el montaje de mi curso.",
    },
    {
      title: "Reclamo por demora en la respuesta de soporte",
      description: "Envié una solicitud hace una semana por correo y no he recibido respuesta.",
    },
    {
      title: "Sugerencia: tutorial para subir videos",
      description: "Sería útil tener una guía corta para docentes sobre cómo subir videos pesados.",
    },
    {
      title: "Felicitación al equipo de auxiliares",
      description: "Agradezco la rapidez con que solucionaron el problema de mi curso.",
    },
  ],
  "solicitud-sistemas": [
    {
      title: "Crear curso virtual para Electiva de Analítica",
      description: "Necesito el espacio en Moodle con la estructura estándar de 16 semanas.",
    },
    {
      title: "Matrícula masiva de 45 estudiantes",
      description: "Adjunto el listado con códigos para matricular en el grupo nuevo.",
    },
    {
      title: "Restaurar respaldo del curso 2026-1",
      description: "Necesito recuperar las actividades del semestre pasado en el curso actual.",
    },
    {
      title: "Configurar el calificador con porcentajes",
      description:
        "Quiero que el libro de calificaciones use los porcentajes del acuerdo pedagógico.",
    },
  ],
  "acceso-matricula": [
    {
      title: "No veo el curso de Física I en mi tablero",
      description: "Ya estoy matriculado en el SEA pero el curso no aparece.",
    },
    {
      title: "No puedo iniciar sesión en Moodle",
      description: "La plataforma dice que mi usuario o contraseña son incorrectos.",
    },
    {
      title: "Estoy matriculado en el grupo equivocado",
      description: "Debería estar en el grupo H2 y aparezco en el H1.",
    },
    {
      title: "Olvidé mi contraseña y el correo de recuperación no llega",
      description: "Ya revisé spam y no llega nada.",
    },
  ],
  "otra-solicitud": [
    {
      title: "Asesoría para grabar clases con OBS",
      description: "Me gustaría una sesión corta para aprender a grabar mis clases.",
    },
    {
      title: "Préstamo de cuenta de Zoom para defensa de tesis",
      description: "La sesión es el próximo jueves en la tarde.",
    },
    {
      title: "Solicitud de certificado de participación",
      description: "Necesito el certificado del diplomado en docencia virtual.",
    },
  ],
};

export const STAFF_REPLIES = [
  "Hola, ya revisamos el caso y aplicamos la corrección. ¿Puedes confirmarnos si ya funciona?",
  "Gracias por reportarlo. Ya quedó solucionado; si vuelve a pasar, responde en este mismo ticket.",
  "Listo, realizamos el ajuste solicitado. Quedamos atentos a cualquier novedad.",
  "Revisamos la configuración del curso y ya quedó como lo pediste.",
];

export const INTERNAL_NOTES = [
  "Es un problema de permisos del rol estudiante en el curso; lo corregí desde administración.",
  "Escalado al equipo de sistemas para revisar el respaldo.",
  "Caso repetido: mismo problema que el semestre pasado con el filtro multimedia.",
];

export const REQUESTER_FOLLOWUPS = [
  "¡Muchas gracias! Ya funciona correctamente.",
  "Confirmo que quedó resuelto. Gracias por la ayuda.",
];

export const TASK_SAMPLES = [
  "Revisar enlaces rotos en {curso}",
  "Cargar los videos de la semana 6 en {curso}",
  "Actualizar el banco de preguntas de {curso}",
  "Configurar el calificador de {curso}",
  "Responder dudas del foro en {curso}",
  "Elaborar guía rápida para subir tareas en Moodle",
  "Hacer respaldo de {curso} antes del cierre de notas",
  "Verificar la matrícula masiva de {curso}",
  "Diseñar el banner de bienvenida de {curso}",
  "Revisar accesibilidad de los PDF de {curso}",
  "Grabar tutorial sobre el uso del calendario de Moodle",
  "Depurar usuarios inactivos del curso {curso}",
];

export const EVIDENCE_NOTES = [
  "Listo. Adjunto captura del curso actualizado.",
  "Se revisaron todas las semanas; se corrigieron los enlaces y se dejó constancia en el acta.",
  "Material cargado y verificado desde la vista de estudiante.",
  "Respaldo generado y guardado en la carpeta compartida del equipo.",
];
