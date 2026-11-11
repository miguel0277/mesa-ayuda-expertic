/** Ajustes que el administrador puede editar desde /admin/ajustes. */
export const EDITABLE_KEYS = [
  "auth.allowedEmailDomains",
  "registration.approvalRoles",
  "attachments.maxSizeMB",
  "tasks.riskThresholdHours",
  "tickets.autoCloseDays",
  "tickets.reopenWindowDays",
  "privacy.noticeVersion",
] as const;
