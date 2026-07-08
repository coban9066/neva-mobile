import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** M2 kapsamındaki modüller için yapısal boş durum. */
export function PlaceholderPage({
  title,
  icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface px-4 py-2.5">
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={icon} title={`${title} — yakında`} description={description} />
      </div>
    </div>
  );
}
