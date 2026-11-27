import type { JSX, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function LoadingState({ children = "Memuat…" }: { children?: ReactNode }): JSX.Element {
  return <p role="status" className="my-4 text-sm text-muted-foreground">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }): JSX.Element {
  return <div className="my-4 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">{children}</div>;
}

export function ErrorState({ title, children, onRetry }: {
  title?: string;
  children: ReactNode;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <Alert variant="destructive" className="my-4">
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
      {onRetry && <Button variant="outline" className="mt-2 min-h-11 justify-self-start" onClick={onRetry}>Coba lagi</Button>}
    </Alert>
  );
}
