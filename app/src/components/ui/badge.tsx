import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { PhoneStatus } from "@/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-muted",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        danger: "bg-destructive/12 text-destructive",
        info: "bg-secondary/12 text-secondary",
        primary: "bg-primary/12 text-primary",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT: Record<PhoneStatus, VariantProps<typeof badgeVariants>["variant"]> = {
  in_stock: "success",
  reserved: "warning",
  sold: "info",
  returned: "danger",
  scrap: "danger",
  consigned: "primary",
};

export function StatusBadge({ status, label }: { status: PhoneStatus; label: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
