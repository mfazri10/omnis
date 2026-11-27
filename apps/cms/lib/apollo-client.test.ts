import { gql } from "@apollo/client";
import { afterAll, expect, test } from "bun:test";

const storage = new Map<string, string>();
const previousWindow = Object.getOwnPropertyDescriptor(
  globalThis,
  "window",
);

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  },
});

const [{ createApolloClient }, { useSessionStore }] = await Promise.all([
  import("./apollo-client"),
  import("../stores/use-session-store"),
]);

afterAll(() => {
  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

async function requestSlugForRoute(
  routeSlug: string | null | undefined,
): Promise<(string | null)[]> {
  const previousSlug = useSessionStore.getState().activeSlug;
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalFetch = globalThis.fetch;
  const requestSlugs: (string | null)[] = [];

  process.env.NEXT_PUBLIC_API_URL = "http://cms-test.local";
  useSessionStore.getState().setActiveSlug("app-a");
  globalThis.fetch = Object.assign(
    (_input: RequestInfo | URL, init?: RequestInit) => {
      requestSlugs.push(new Headers(init?.headers).get("X-App-Slug"));
      return Promise.resolve(
        new Response(JSON.stringify({ data: { contextProbe: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
    { preconnect: originalFetch.preconnect },
  );

  const client = createApolloClient();
  try {
    await client.query({
      query: gql`query ContextProbe { contextProbe }`,
      context:
        routeSlug === undefined ? {} : { appSlug: routeSlug },
    });
    return requestSlugs;
  } finally {
    client.stop();
    globalThis.fetch = originalFetch;
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
    useSessionStore.getState().setActiveSlug(previousSlug);
  }
}

test("uses the route app slug when the persisted app slug is stale", async () => {
  expect(await requestSlugForRoute("app-b")).toEqual(["app-b"]);
});

test("omits a stale app slug for a global route", async () => {
  expect(await requestSlugForRoute(null)).toEqual([null]);
});

test("uses the persisted slug when a query has no route context", async () => {
  expect(await requestSlugForRoute(undefined)).toEqual(["app-a"]);
});
