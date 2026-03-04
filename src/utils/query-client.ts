import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient configuration for TanStack Start
 *
 * TanStack Start automatically uses React Query for server functions created with `createServerFn`.
 * This QueryClient configuration provides default caching behavior.
 *
 * For user queries specifically, we configure longer cache times since user data
 * doesn't change frequently and we want to reduce unnecessary calls to getUser().
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default staleTime: 0 (data is immediately stale)
      staleTime: 0,
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

/**
 * Configure default options for user/auth queries
 * These queries should be cached longer since user data doesn't change frequently
 *
 * This sets defaults for any query with the key pattern ["user", ...]
 * When getUser() is called, TanStack Start will use these caching options
 */
queryClient.setQueryDefaults(["user"], {
  staleTime: 5 * 60 * 1000, // 5 minutes - user data is considered fresh for 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes after unused
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});
