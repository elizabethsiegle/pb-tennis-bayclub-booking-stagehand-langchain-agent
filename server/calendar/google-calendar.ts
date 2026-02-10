import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CalendarEvent {
  summary: string;
  location: string;
  description: string;
  startDateTime: Date;
  endDateTime: Date;
}

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private initialized = false;

  /**
   * Initialize Google Calendar API service
   */
  async init() {
    try {
      // Check for credentials file or environment variable
      const credentialsPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH 
        || resolve(__dirname, '../../google-calendar-credentials.json');
      
      const credentialsJson = process.env.GOOGLE_CALENDAR_CREDENTIALS;

      let credentials: any;

      if (credentialsJson) {
        // Use credentials from environment variable (for production)
        credentials = JSON.parse(credentialsJson);
        console.log('[Calendar] Using credentials from environment variable');
      } else if (existsSync(credentialsPath)) {
        // Use credentials file (for local development)
        credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
        console.log('[Calendar] Using credentials from file:', credentialsPath);
      } else {
        console.warn('[Calendar] No credentials found, calendar integration disabled');
        return;
      }

      const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      this.calendar = google.calendar({ version: 'v3', auth });
      this.initialized = true;
      console.log('[Calendar] Service initialized successfully');
    } catch (error) {
      console.error('[Calendar] Failed to initialize:', error);
    }
  }

  /**
   * Check if calendar service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.calendar !== null;
  }

  /**
   * Add an event to Google Calendar
   */
  async addEvent(event: CalendarEvent): Promise<boolean> {
    if (!this.calendar) {
      console.warn('[Calendar] Service not available, skipping event creation');
      return false;
    }

    try {
      console.log('[Calendar] Adding event:', event.summary);

      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      const calendarEvent: calendar_v3.Schema$Event = {
        summary: event.summary,
        location: event.location,
        description: event.description,
        start: {
          dateTime: event.startDateTime.toISOString(),
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: event.endDateTime.toISOString(),
          timeZone: 'America/Los_Angeles',
        },
      };

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: calendarEvent,
      });

      const startFormatted = event.startDateTime.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      });

      console.log(`[Calendar] ✓ Event created: ${startFormatted}`);
      console.log(`[Calendar] Event ID: ${response.data.id}`);
      return true;
    } catch (error) {
      console.error('[Calendar] Failed to add event:', error);
      return false;
    }
  }

  /**
   * Create a court booking event
   */
  async addCourtBooking(
    sport: 'tennis' | 'pickleball',
    date: Date,
    time: string,
    buddy: string = 'Samuel Wang'
  ): Promise<boolean> {
    // Parse the time string (e.g., "2:00 PM" or "14:00")
    const startDateTime = this.parseTimeToDate(date, time);
    if (!startDateTime) {
      console.error('[Calendar] Failed to parse time:', time);
      return false;
    }

    // Tennis is 90 minutes, pickleball is 60 minutes
    const durationMinutes = sport === 'tennis' ? 90 : 60;
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

    const sportEmoji = sport === 'tennis' ? '🎾' : '🥒';
    const sportName = sport.charAt(0).toUpperCase() + sport.slice(1);

    return this.addEvent({
      summary: `${sportEmoji} ${sportName} - Bay Club Gateway`,
      location: 'Bay Club Gateway, San Francisco, CA',
      description: `${sportName} court booking at Bay Club Gateway\n\nBuddy: ${buddy}\nDuration: ${durationMinutes} minutes\n\nBooked via Tennis Booking Chat App`,
      startDateTime,
      endDateTime,
    });
  }

  /**
   * Parse a time string and combine with a date
   */
  private parseTimeToDate(date: Date, timeStr: string): Date | null {
    try {
      // Handle formats like "2:00 PM", "2:00PM", "14:00", "2pm"
      const normalizedTime = timeStr.trim().toUpperCase();
      
      let hours: number;
      let minutes: number = 0;

      // Match patterns like "2:00 PM", "2:30PM", "2 PM", "2PM"
      const match12Hour = normalizedTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
      // Match patterns like "14:00", "9:30"
      const match24Hour = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);

      if (match12Hour) {
        hours = parseInt(match12Hour[1], 10);
        minutes = match12Hour[2] ? parseInt(match12Hour[2], 10) : 0;
        const isPM = match12Hour[3] === 'PM';
        
        if (hours === 12) {
          hours = isPM ? 12 : 0;
        } else if (isPM) {
          hours += 12;
        }
      } else if (match24Hour) {
        hours = parseInt(match24Hour[1], 10);
        minutes = parseInt(match24Hour[2], 10);
      } else {
        return null;
      }

      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const calendarService = new GoogleCalendarService();
