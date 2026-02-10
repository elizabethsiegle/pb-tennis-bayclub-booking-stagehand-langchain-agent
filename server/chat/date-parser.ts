import {
  addDays,
  nextDay,
  parse,
  isValid,
  format,
  startOfDay,
  getDay
} from 'date-fns';

/**
 * Parse natural language date strings into Date objects
 * Today's date: Tuesday, February 10, 2026
 */
export class DateParser {
  private baseDate: Date;

  constructor() {
    // Set base date to today: February 10, 2026
    this.baseDate = startOfDay(new Date());
  }

  /**
   * Parse a date string and return a Date object
   * Supports:
   * - "today" / "tonight"
   * - "tomorrow"
   * - Day names: "monday", "tuesday", "wednesday", etc.
   * - "next [day]": "next monday"
   * - ISO dates: "2026-02-10"
   * - Human dates: "Feb 10", "February 10"
   */
  parse(dateString: string): Date | null {
    const normalized = dateString.toLowerCase().trim();

    // Handle "today" or "tonight"
    if (normalized === 'today' || normalized === 'tonight') {
      return this.baseDate;
    }

    // Handle "tomorrow"
    if (normalized === 'tomorrow') {
      return addDays(this.baseDate, 1);
    }

    // Handle day names (e.g., "wednesday", "monday")
    const dayMatch = this.parseDayName(normalized);
    if (dayMatch) {
      return dayMatch;
    }

    // Handle "next [day]" (e.g., "next monday")
    const nextDayMatch = normalized.match(/^next\s+(\w+)$/);
    if (nextDayMatch) {
      const day = this.getDayOfWeek(nextDayMatch[1]);
      if (day !== null) {
        // Get the next occurrence of this day (next week)
        const thisWeekDay = nextDay(this.baseDate, day as 0 | 1 | 2 | 3 | 4 | 5 | 6);
        return addDays(thisWeekDay, 7); // Add 7 days to get next week
      }
    }

    // Handle absolute dates
    return this.parseAbsoluteDate(normalized);
  }

  /**
   * Parse day name like "wednesday" or "monday"
   * Returns the next occurrence of that day
   */
  private parseDayName(dayString: string): Date | null {
    const day = this.getDayOfWeek(dayString);
    if (day === null) return null;

    const currentDay = getDay(this.baseDate);

    // If the day is today, return today
    if (day === currentDay) {
      return this.baseDate;
    }

    // Return next occurrence of this day (could be this week or next week)
    return nextDay(this.baseDate, day as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  }

  /**
   * Convert day name to day number (0 = Sunday, 1 = Monday, etc.)
   */
  private getDayOfWeek(dayName: string): number | null {
    const days: Record<string, number> = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sun': 0,
      'mon': 1,
      'tue': 2,
      'wed': 3,
      'thu': 4,
      'fri': 5,
      'sat': 6
    };

    return days[dayName.toLowerCase()] ?? null;
  }

  /**
   * Parse absolute dates like "2026-02-10", "Feb 10", "February 10"
   */
  private parseAbsoluteDate(dateString: string): Date | null {
    // Try ISO format (2026-02-10)
    let date = parse(dateString, 'yyyy-MM-dd', this.baseDate);
    if (isValid(date)) return startOfDay(date);

    // Try "Feb 10" format
    date = parse(dateString, 'MMM d', this.baseDate);
    if (isValid(date)) return startOfDay(date);

    // Try "February 10" format
    date = parse(dateString, 'MMMM d', this.baseDate);
    if (isValid(date)) return startOfDay(date);

    // Try "Feb 10, 2026" format
    date = parse(dateString, 'MMM d, yyyy', this.baseDate);
    if (isValid(date)) return startOfDay(date);

    // Try "February 10, 2026" format
    date = parse(dateString, 'MMMM d, yyyy', this.baseDate);
    if (isValid(date)) return startOfDay(date);

    return null;
  }

  /**
   * Format a date for display
   */
  format(date: Date): string {
    return format(date, 'EEEE, MMMM d, yyyy');
  }

  /**
   * Get a short format for display
   */
  formatShort(date: Date): string {
    return format(date, 'MMM d');
  }
}

// Export singleton instance
export const dateParser = new DateParser();
