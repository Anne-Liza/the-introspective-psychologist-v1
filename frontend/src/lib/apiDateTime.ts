const TIMEZONE_SUFFIX =
  /(?:Z|[+-]\d{2}:\d{2})$/i;

/**
 * Backend timestamps are stored as UTC.
 *
 * Some legacy API responses contain UTC datetimes
 * without an explicit `Z` suffix. JavaScript would
 * otherwise interpret those values as local time.
 *
 * Explicit timezone information is preserved.
 */
export function parseApiDateTime(
  value: string,
): Date {
  const normalized = value.trim();

  return new Date(
    TIMEZONE_SUFFIX.test(normalized)
      ? normalized
      : `${normalized}Z`,
  );
}
