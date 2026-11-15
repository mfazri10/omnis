import { CombinedGraphQLErrors } from "@apollo/client";

/** True bila galat memuat code FORBIDDEN (doc 07). */
export function isForbiddenError(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((err) => err.extensions?.code === "FORBIDDEN")
  );
}

/** Pesan galat GraphQL pertama, atau fallback bila tak ada. */
export function graphQLErrorMessage(error: unknown, fallback: string): string {
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];
    if (first) {
      return first.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
