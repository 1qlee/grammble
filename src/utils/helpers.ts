/**
 * Executes an async callback and ensures it takes at least the specified minimum delay.
 * This is useful for ensuring loading states remain visible for a minimum duration.
 *
 * @param callback - The async function to execute
 * @param minimumDelayMs - The minimum delay in milliseconds
 * @returns The result of the callback
 */
export async function withMinimumDelay<T>(
  callback: () => Promise<T>,
  minimumDelayMs: number
): Promise<T> {
  // Create a promise that resolves after the minimum delay
  const minimumDelay = new Promise<void>((resolve) =>
    setTimeout(resolve, minimumDelayMs)
  );

  // Start both the callback and the delay timer
  const callbackPromise = callback();

  // Wait for both the callback and the minimum delay to complete
  // This ensures the function takes at least minimumDelayMs
  const [result] = await Promise.all([callbackPromise, minimumDelay]);

  return result;
}
