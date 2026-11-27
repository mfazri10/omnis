import type { ComponentProps, JSX } from "react";
import { cn } from "@/lib/utils";

export function TableToolbar({ className, ...props }: ComponentProps<"form">): JSX.Element {
  return <form className={cn("my-4 flex flex-wrap items-end gap-2", className)} {...props} />;
}
