/**
 * One value out of a search parameter that may have arrived more than once.
 *
 * Next hands `?next=/a&next=/b` over as an array, and every caller here wants
 * a single string. Taking the first is not an interpretation of the reader's
 * intent — a repeated parameter is either a mistake or an attempt to smuggle
 * one value past a check that read the other. What makes it safe is that the
 * value is validated after this, not by it.
 */
export function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
