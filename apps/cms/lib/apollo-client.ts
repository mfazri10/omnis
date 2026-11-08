import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export function createApolloClient(): ApolloClient {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  return new ApolloClient({
    link: new HttpLink({ uri: `${apiUrl}/graphql`, credentials: "include" }),
    cache: new InMemoryCache(),
    // CMS adalah alat admin: selalu ambil data segar, bukan cache basi.
    defaultOptions: { watchQuery: { fetchPolicy: "network-only" } },
  });
}

// NOTE(F02): sisipkan header X-App-Slug dinamis dari route aktif via middleware link.
