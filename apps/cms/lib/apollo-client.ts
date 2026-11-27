import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { useSessionStore } from "../stores/use-session-store";
import { useToastStore } from "../stores/use-toast-store";
import { CMS_PICKER_PATH } from "@/features/shell/routes";

function errorCodes(error: unknown): string[] {
  if (!CombinedGraphQLErrors.is(error)) {
    return [];
  }
  return error.errors.flatMap((err) => {
    const code: unknown = err.extensions?.code;
    return typeof code === "string" ? [code] : [];
  });
}

function navigate(path: string): void {
  if (
    typeof window !== "undefined" &&
    window.location.pathname !== path
  ) {
    window.location.href = path;
  }
}

const errorLink = onError(({ error }) => {
  const codes = errorCodes(error);
  if (codes.includes("UNAUTHENTICATED")) {
    navigate("/login");
    return;
  }
  if (codes.includes("FORBIDDEN")) {
    navigate("/403");
    return;
  }
  if (
    codes.includes("APP_NOT_FOUND") ||
    codes.includes("APP_SUSPENDED")
  ) {
    useToastStore
      .getState()
      .push("Aplikasi tidak tersedia atau aksesnya berubah. Silakan pilih aplikasi.");
    navigate(CMS_PICKER_PATH);
  }
});

const appContextLink = new ApolloLink((operation, forward) => {
  const prev = operation.getContext() as {
    appSlug?: string | null;
    headers?: Record<string, string>;
  };
  const hasAppSlug = Object.prototype.hasOwnProperty.call(prev, "appSlug");
  const slug = hasAppSlug
    ? prev.appSlug
    : useSessionStore.getState().activeSlug;
  const headers = { ...prev.headers };

  if (hasAppSlug && slug === null) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "x-app-slug") delete headers[key];
    }
  } else if (slug !== null && slug !== undefined) {
    headers["X-App-Slug"] = slug;
  }

  operation.setContext({
    headers,
  });
  return forward(operation);
});

export function createApolloClient(): ApolloClient {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  return new ApolloClient({
    link: from([
      errorLink,
      appContextLink,
      new HttpLink({ uri: `${apiUrl}/graphql`, credentials: "include" }),
    ]),
    cache: new InMemoryCache(),
    // CMS adalah alat admin: selalu ambil data segar, bukan cache basi.
    defaultOptions: { watchQuery: { fetchPolicy: "network-only" } },
  });
}
