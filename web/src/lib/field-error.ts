// TanStack Form v1 surfaces validation errors as standard-schema issue
// objects (`{ message, path }`), not bare strings. Pull the human-readable
// message out for rendering.
export function fieldError(errors: unknown[] | undefined): string | undefined {
  const e = errors?.[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
