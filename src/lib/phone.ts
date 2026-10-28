/**
 * KZ/RU phone helpers — same rules as neurokids:
 * canonical 11 digits (77051112240), display +7 705 111 22 40.
 */

export function normalizeKzPhoneDigits(raw?: string): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }
  if (digits.length === 10) digits = `7${digits}`;
  return digits.slice(0, 11);
}

export function isValidKzPhone(raw?: string): boolean {
  const digits = normalizeKzPhoneDigits(raw);
  return digits.length === 11 && digits.startsWith("7");
}

/** +7 705 111 22 40 */
export function formatKzPhoneDisplay(raw?: string): string {
  const digits = normalizeKzPhoneDigits(raw);
  if (!digits) return "";
  const m = digits.match(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return digits ? `+${digits}` : "";
  return `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
}

/**
 * Parse typed/pasted input into canonical digits for the +7 mask.
 */
export function parsePhoneInput(input: string): string {
  const trimmed = input.trimStart();
  const rawDigits = input.replace(/\D/g, "");
  if (!rawDigits) return "";

  if (trimmed.startsWith("+7")) {
    const rest = trimmed.slice(2).replace(/\D/g, "");
    if (rest.startsWith("8")) return (`7${rest.slice(1)}`).slice(0, 11);
    if (rest.startsWith("7")) {
      if (rest.length >= 11) return rest.slice(0, 11);
      return (`7${rest}`).slice(0, 11);
    }
    return (`7${rest}`).slice(0, 11);
  }

  if (rawDigits.startsWith("8")) return (`7${rawDigits.slice(1)}`).slice(0, 11);
  if (rawDigits.startsWith("7") && rawDigits.length >= 11) {
    return rawDigits.slice(0, 11);
  }
  return (`7${rawDigits}`).slice(0, 11);
}

export function formatPhoneInputMask(canonical: string): string {
  if (!canonical) return "+7";
  return formatKzPhoneDisplay(canonical) || "+7";
}
