"use client";

import { ApolloProvider as BaseProvider } from "@apollo/client/react";
import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { createApolloClient } from "./apollo-client";

export function ApolloProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [client] = useState(createApolloClient);
  return <BaseProvider client={client}>{children}</BaseProvider>;
}
