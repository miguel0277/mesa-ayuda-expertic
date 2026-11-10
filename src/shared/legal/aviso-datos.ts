/**
 * Aviso de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013).
 *
 * ⚠ TEXTO PROVISIONAL: debe reemplazarse por el aviso oficial de la UIS antes de salir a producción.
 * Al cambiar el texto, sube la versión: queda registrada con cada aceptación (user.data_consent_version).
 */
export const PRIVACY_NOTICE_VERSION = "2026-11-v1-provisional";

export const PRIVACY_NOTICE: { title: string; paragraphs: string[] } = {
  title: "Aviso de tratamiento de datos personales",
  paragraphs: [
    "La Universidad Industrial de Santander (UIS), a través de ExperTIC, recolecta tu nombre, correo, código UIS, programa o escuela y, si lo das, tu teléfono, para gestionar las solicitudes de soporte que hagas en esta plataforma, asignarlas al equipo que las atiende y avisarte sobre su estado.",
    "También guardamos un registro de las acciones que haces en la plataforma (por ejemplo, crear o responder una solicitud) con la fecha, la hora y la dirección IP, para poder hacer seguimiento y auditoría del servicio.",
    "Tus datos no se venden ni se comparten con terceros ajenos a la Universidad. Solo los ve el personal de ExperTIC que necesita atender tu solicitud.",
    "Como titular tienes derecho a conocer, actualizar, rectificar y pedir la supresión de tus datos, y a revocar esta autorización, en los términos de la Ley 1581 de 2012. Puedes ejercerlos escribiendo al equipo de ExperTIC.",
    "Al marcar la casilla autorizas este tratamiento. Guardamos la fecha y la versión de este aviso junto con tu cuenta.",
  ],
};
