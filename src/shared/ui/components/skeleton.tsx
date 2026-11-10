import { cn } from "cn";

/**
 * Skeleton con shimmer (brillo que recorre) en lugar de parpadeo.
 * Se anima `transform` del pseudo-elemento: no repinta. Con reduced-motion queda estático.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_ease-in-out_infinite]",
        "after:bg-linear-to-r after:from-transparent after:via-white/60 after:to-transparent dark:after:via-white/5",
        "motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
