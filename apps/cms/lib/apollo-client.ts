import {
  ApolloClient,
  CombinedGraphQLErrors,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";

const errorLink = onError(({ error }) => {
  const expired =
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((err) => err.extensions?.code === "UNAUTHENTICATED");
  if (
    expired &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login"
  ) {
    window.location.href = "/login";
  }
});

export function createApolloClient(): ApolloClient {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  return new ApolloClient({
    link: from([
      errorLink,
      new HttpLink({ uri: `${apiUrl}/graphql`, credentials: "include" }),
    ]),
    cache: new InMemoryCache(),
    // CMS adalah alat admin: selalu ambil data segar, bukan cache basi.
    defaultOptions: { watchQuery: { fetchPolicy: "network-only" } },
  });
}

// NOTE(F02): sisipkan header X-App-Slug dinamis dari route aktif via middleware link.
