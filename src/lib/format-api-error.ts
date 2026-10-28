/** Normalize API / Zod errors into a human-readable string */
export function formatApiError(error: unknown, fallback = "Ошибка"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (obj.formErrors && Array.isArray(obj.formErrors) && obj.formErrors.length) {
      return obj.formErrors.map(String).join("; ");
    }
    if (obj.fieldErrors && typeof obj.fieldErrors === "object") {
      const parts = Object.entries(obj.fieldErrors as Record<string, unknown>).flatMap(
        ([field, msgs]) => {
          if (Array.isArray(msgs) && msgs.length) return [`${field}: ${msgs.join(", ")}`];
          return [];
        },
      );
      if (parts.length) return parts.join("; ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
