import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", className = "", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={`orva-badge orva-badge--${tone} ${className}`.trim()} {...props} />;
}