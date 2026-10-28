/** The calendar day this device last slid the opening screen away. */
export const DAILY_SLIDE_KEY = "baumb:daily-slide";

/** The opening screen is due on the first open of a day, and not again until the next day. */
export function dailySlideDue(stored: string | null, today: string) {
  return stored !== today;
}
