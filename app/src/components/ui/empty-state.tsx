import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-surface-2 p-3 text-fg-muted">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-fg-muted">{description}</p>}
      {action && (
        <Button variant="primary" size="sm" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
