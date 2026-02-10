import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BayClubBot, Sport } from '../booking/stagehand-bot.js';
import { dateParser } from '../chat/date-parser.js';
import { calendarService } from '../calendar/google-calendar.js';

export class BookingToolManager {
  private bot: BayClubBot;
  private initialized = false;
  private calendarInitialized = false;

  constructor(username: string, password: string) {
    this.bot = new BayClubBot(username, password);
    // Initialize calendar service in background
    this.initCalendar();
  }

  /**
   * Initialize calendar service (non-blocking)
   */
  private async initCalendar() {
    try {
      await calendarService.init();
      this.calendarInitialized = calendarService.isAvailable();
    } catch (error) {
      console.error('[BookingToolManager] Calendar init error:', error);
    }
  }

  /**
   * Lazy initialization - only starts browser when actually needed
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      console.log('[BookingToolManager] Initializing browser (first use)...');
      await this.bot.init();
      await this.bot.login();
      this.initialized = true;
      console.log('[BookingToolManager] Browser ready!');
    }
  }

  async initialize() {
    // No-op - we use lazy initialization now
  }

  async cleanup() {
    if (this.initialized) {
      await this.bot.close();
      this.initialized = false;
    }
  }

  /**
   * Close the browser session (can be re-initialized later)
   */
  private async closeBrowser() {
    if (this.initialized) {
      console.log('[BookingToolManager] Closing browser session...');
      await this.bot.close();
      this.initialized = false;
      console.log('[BookingToolManager] Browser session closed.');
    }
  }

  /**
   * Create the LangChain tool for booking courts
   */
  createTool() {
    return new DynamicStructuredTool({
      name: 'book_tennis_court',
      description: `Tennis and pickleball court booking tool for Bay Club Gateway.

ACTIONS:
- "query_times": Check available time slots (use when user says "check courts", "see times", "what's available", etc.)
- "book": Make a reservation with Samuel Wang as buddy (ONLY use when user explicitly says "book", "reserve", "make a booking", etc.)

Today's date is Friday, February 6, 2026. Use this to calculate dates like "Wednesday" or "tomorrow".

IMPORTANT: If user just wants to check availability, use "query_times" action. Only use "book" when they explicitly want to make a reservation.`,
      schema: z.object({
        action: z.enum(['query_times', 'book']).describe('Action: "query_times" to CHECK availability (default for "check courts", "see times"), "book" to MAKE a reservation (only when user explicitly wants to book)'),
        sport: z.enum(['tennis', 'pickleball']).describe('Sport to book: tennis (90 min) or pickleball (60 min)'),
        date: z.string().describe('Date string like "today", "tomorrow", "wednesday", "feb 10", etc.'),
        time: z.string().optional().describe('Time slot for booking (e.g., "2:00 PM"). Only required for "book" action.')
      }),
      func: async ({ action, sport, date, time }) => {
        try {
          console.log(`[Tool] Action: ${action}, Sport: ${sport}, Date: ${date}, Time: ${time || 'N/A'}`);

          // Lazy init: only start browser when actually needed
          await this.ensureInitialized();

          // Parse the date
          const parsedDate = dateParser.parse(date);
          if (!parsedDate) {
            return `Error: Could not parse date "${date}". Please provide a valid date like "today", "tomorrow", "wednesday", "feb 10", etc.`;
          }

          const formattedDate = dateParser.format(parsedDate);
          console.log(`[Tool] Parsed date: ${formattedDate}`);

          if (action === 'query_times') {
            // Navigate to booking page with club selection
            const dayOfWeek = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
            await this.bot.navigateToBooking(sport as Sport, dayOfWeek);

            // Get available times
            const times = await this.bot.getAvailableTimes();

            if (times.length === 0) {
              return `No available ${sport} courts on ${formattedDate}.`;
            }

            return `Available ${sport} courts on ${formattedDate}:\n${times.map(t => `- ${t}`).join('\n')}`;
          }

          else if (action === 'book') {
            if (!time) {
              return 'Error: Time is required for booking. Please specify a time slot.';
            }

            // Navigate to booking page with club selection
            const dayOfWeek = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
            await this.bot.navigateToBooking(sport as Sport, dayOfWeek);

            // Book the court
            const success = await this.bot.bookCourt(time);

            if (success) {
              // Close the browser session after successful booking to save Browserbase minutes
              await this.closeBrowser();

              // Add to Google Calendar
              let calendarMessage = '';
              if (this.calendarInitialized) {
                const calendarSuccess = await calendarService.addCourtBooking(
                  sport as 'tennis' | 'pickleball',
                  parsedDate,
                  time,
                  'Samuel Wang'
                );
                if (calendarSuccess) {
                  calendarMessage = ' 📅 Added to your Google Calendar!';
                }
              }

              return `Successfully booked ${sport} court on ${formattedDate} at ${time} with Samuel Wang!${calendarMessage}`;
            } else {
              return `Failed to book ${sport} court on ${formattedDate} at ${time}. The slot may no longer be available.`;
            }
          }

          return 'Error: Invalid action';
        } catch (error) {
          console.error('[Tool] Error:', error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        }
      }
    });
  }
}
