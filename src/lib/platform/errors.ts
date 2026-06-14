/**
 * Convex surfaces server `throw new Error("CODE: message")` wrapped in a noisy
 * envelope. This extracts the human-friendly message for display in the UI.
 */
export function cleanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const match = raw.match(/Uncaught Error:\s*(.*?)(?:\n|$)/);
  let text = match?.[1] ?? raw;
  // Drop a leading machine code like "FORBIDDEN: " / "NOT_FOUND: ".
  text = text.replace(/^[A-Z_]+:\s*/, "");
  return text.trim() || "Something went wrong";
}
