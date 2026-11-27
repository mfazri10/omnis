import type { ComponentProps, JSX } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & Pick<Parameters<typeof buttonVariants>[0] & object, "variant">;

export function ButtonLink({ className, variant, ...props }: Props): JSX.Element {
  return <Link className={cn(buttonVariants({ variant }), "min-h-11", className)} {...props} />;
}
