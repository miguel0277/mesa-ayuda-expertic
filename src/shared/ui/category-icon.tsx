import {
  Bug,
  CircleQuestionMark,
  FileQuestionMark,
  KeyRound,
  MessageCircleQuestionMark,
  ServerCog,
  type LucideIcon,
} from "lucide-react";

/**
 * Íconos de categorías de ticket. La BD guarda el nombre (ticket_types.icon);
 * aquí se traduce a componente. Lista cerrada: el editor de plantillas solo ofrece estas.
 */
export const CATEGORY_ICONS = {
  bug: Bug,
  "file-question": FileQuestionMark,
  "message-circle-question": MessageCircleQuestionMark,
  "server-cog": ServerCog,
  "key-round": KeyRound,
  "circle-help": CircleQuestionMark,
} as const satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name as CategoryIconName] ?? CircleQuestionMark;
}
