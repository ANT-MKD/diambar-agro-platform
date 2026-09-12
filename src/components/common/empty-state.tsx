import { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  docHref,
  docLabel = "En savoir plus",
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  docHref?: string;
  docLabel?: string;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${className}`}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      )}
      {(action || docHref) && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {action}
          {docHref && (
            <a
              href={docHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline underline-offset-4"
            >
              {docLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
