/**
 * Ilustraciones propias, dibujadas con los tokens de color (se adaptan al modo oscuro).
 * Decorativas: llevan aria-hidden; el texto de la página explica el estado.
 */

type Props = { className?: string };

/** 403: una puerta con candado, sin dramatismo. */
export function ForbiddenIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" fill="none">
      <circle cx="80" cy="60" r="52" className="fill-secondary" />
      <rect
        x="54"
        y="26"
        width="52"
        height="74"
        rx="4"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      <rect x="60" y="32" width="40" height="62" rx="2" className="fill-muted" />
      <circle cx="93" cy="64" r="2.5" className="fill-muted-foreground" />
      <rect x="70" y="56" width="24" height="20" rx="4" className="fill-brand-blue" />
      <path
        d="M75 56v-6a7 7 0 0 1 14 0v6"
        className="stroke-brand-blue"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="82" cy="64" r="2.5" className="fill-white" />
      <rect x="81" y="65" width="2" height="5" rx="1" className="fill-white" />
      <circle cx="122" cy="34" r="6" className="fill-brand-green" />
    </svg>
  );
}

/** 404: una brújula que no encuentra el norte. */
export function NotFoundIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" fill="none">
      <circle cx="80" cy="60" r="52" className="fill-secondary" />
      <circle cx="80" cy="60" r="34" className="fill-card stroke-border" strokeWidth="2" />
      <circle
        cx="80"
        cy="60"
        r="26"
        className="stroke-muted"
        strokeWidth="2"
        strokeDasharray="3 5"
      />
      <path d="M80 60 L92 40 L84 62 Z" className="fill-brand-blue" />
      <path d="M80 60 L68 80 L76 58 Z" className="fill-muted-foreground" />
      <circle cx="80" cy="60" r="3" className="fill-foreground" />
      <circle cx="124" cy="30" r="6" className="fill-brand-green" />
      <text x="117" y="96" className="fill-muted-foreground" fontSize="14" fontWeight="600">
        ?
      </text>
    </svg>
  );
}

/** Error: un enchufe desconectado. */
export function ErrorIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" fill="none">
      <circle cx="80" cy="60" r="52" className="fill-late-soft" />
      <path
        d="M24 70 H58"
        className="stroke-muted-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="56"
        y="58"
        width="18"
        height="24"
        rx="4"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      <path
        d="M74 64h6M74 76h6"
        className="stroke-muted-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="92"
        y="58"
        width="18"
        height="24"
        rx="4"
        className="fill-card stroke-border"
        strokeWidth="2"
      />
      <path
        d="M110 70 H136"
        className="stroke-muted-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M84 44l-4 8h6l-4 8"
        className="stroke-late"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
