import * as React from "react";

/**
 * A custom React hook for managing asynchronous mutations (e.g., API calls, server functions).
 *
 * This hook provides a simple state machine for tracking the lifecycle of async operations:
 * - Manages loading states (idle → pending → success/error)
 * - Stores the mutation result data or error
 * - Tracks when the mutation was submitted
 * - Provides a `mutate` function to trigger the mutation
 * - Supports an optional `onSuccess` callback
 *
 * @template TVariables - The type of variables/input passed to the mutation function
 * @template TData - The type of data returned by the mutation function
 * @template TError - The type of error that can be thrown (defaults to Error)
 *
 * @param opts - Configuration options for the mutation
 * @param opts.fn - The async function to execute when `mutate` is called
 * @param opts.onSuccess - Optional callback invoked after a successful mutation. Receives the result data.
 *
 * @returns An object containing:
 * - `status`: Current state of the mutation ('idle' | 'pending' | 'success' | 'error')
 * - `data`: The result data from the last successful mutation
 * - `error`: The error from the last failed mutation
 * - `variables`: The variables passed to the last mutation call
 * - `submittedAt`: Timestamp (ms) when the last mutation was submitted
 * - `mutate`: Function to trigger the mutation with new variables
 *
 * @example
 * ```tsx
 * const loginMutation = useMutation({
 *   fn: loginFn,
 *   onSuccess: async (ctx) => {
 *     if (!ctx.data?.error) {
 *       await router.invalidate();
 *       router.navigate({ to: "/" });
 *     }
 *   },
 * });
 *
 * // Trigger the mutation
 * loginMutation.mutate({
 *   email: "user@example.com",
 *   password: "password123",
 * });
 *
 * // Use the state in your component
 * {loginMutation.status === 'pending' && <Spinner />}
 * {loginMutation.error && <Error message={loginMutation.error} />}
 * {loginMutation.data && <Success data={loginMutation.data} />}
 * ```
 */
export function useMutation<TVariables, TData, TError = Error>(opts: {
  fn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (ctx: { data: TData }) => void | Promise<void>;
}) {
  const [submittedAt, setSubmittedAt] = React.useState<number | undefined>();
  const [variables, setVariables] = React.useState<TVariables | undefined>();
  const [error, setError] = React.useState<TError | undefined>();
  const [data, setData] = React.useState<TData | undefined>();
  const [status, setStatus] = React.useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const mutate = React.useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      setStatus("pending");
      setSubmittedAt(Date.now());
      setVariables(variables);
      //
      try {
        const data = await opts.fn(variables);
        await opts.onSuccess?.({ data });
        setStatus("success");
        setError(undefined);
        setData(data);
        return data;
      } catch (err: any) {
        setStatus("error");
        setError(err);
      }
    },
    [opts.fn]
  );

  return {
    status,
    variables,
    submittedAt,
    mutate,
    error,
    data,
  };
}
