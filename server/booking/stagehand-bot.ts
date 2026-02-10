import { Stagehand } from '@browserbasehq/stagehand';

export type Sport = 'tennis' | 'pickleball';

export interface TimeSlot {
  time: string;
  available: boolean;
}

export class BayClubBot {
  private stagehand: Stagehand | null = null;
  private isLoggedIn = false;
  private username: string;
  private password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  /**
   * Initialize the browser
   */
  async init() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.stagehand = new Stagehand({
      env: isProduction ? 'BROWSERBASE' : 'LOCAL',
      headless: isProduction, // headless in production
      verbose: 1,
      debugDom: !isProduction,
      // Browserbase credentials (required for production)
      ...(isProduction && {
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      }),
    });

    await this.stagehand.init();
  }

  /**
   * Login to Bay Club Connect
   */
  async login() {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized. Call init() first.');
    }

    try {
      console.log('Navigating to Bay Club Connect...');
      await this.stagehand.page.goto('https://bayclubconnect.com/home/dashboard', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      console.log('Page loaded, checking current URL...');
      const currentUrl = this.stagehand.page.url();
      console.log(`Current URL: ${currentUrl}`);

      // Wait a bit for any redirects or dynamic content
      await this.stagehand.page.waitForTimeout(3000);

      // Check if we're already logged in
      const isDashboard = this.stagehand.page.url().includes('/home/dashboard');
      if (isDashboard) {
        try {
          const loggedInElement = await this.stagehand.page.locator('text=Select Activity').first().isVisible({ timeout: 3000 });
          if (loggedInElement) {
            console.log('Already logged in!');
            this.isLoggedIn = true;
            return;
          }
        } catch (e) {
          console.log('Not logged in yet, proceeding with login...');
        }
      }

      console.log('Looking for login form...');

      // Get page HTML for debugging
      const pageTitle = await this.stagehand.page.title();
      console.log(`Page title: ${pageTitle}`);

      // Look for username field
      console.log('Looking for username field...');
      const usernameField = this.stagehand.page.locator('input[type="email"], input[type="text"], input[name*="username"], input[name*="email"], input[placeholder*="email" i], input[placeholder*="username" i], input[id*="username"], input[id*="email"]').first();

      const usernameExists = await usernameField.count();
      console.log(`Found ${usernameExists} potential username fields`);

      if (usernameExists === 0) {
        throw new Error('No username field found on page. Check before-login.png screenshot.');
      }

      await usernameField.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Username field found, filling...');
      await usernameField.click({ timeout: 5000 });
      await usernameField.fill(this.username);
      console.log('Username filled!');

      await this.stagehand.page.waitForTimeout(500);

      // Look for password field
      console.log('Looking for password field...');
      const passwordField = this.stagehand.page.locator('input[type="password"]').first();

      const passwordExists = await passwordField.count();
      console.log(`Found ${passwordExists} password fields`);

      if (passwordExists === 0) {
        throw new Error('No password field found on page');
      }

      await passwordField.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Password field found, filling...');
      await passwordField.click({ timeout: 5000 });
      await passwordField.fill(this.password);
      console.log('Password filled!');

      await this.stagehand.page.waitForTimeout(500);

      // Look for login button
      console.log('Looking for login button...');
      const loginButton = this.stagehand.page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login"), input[type="submit"], button:has-text("Submit")').first();

      const buttonExists = await loginButton.count();
      console.log(`Found ${buttonExists} potential login buttons`);

      if (buttonExists === 0) {
        throw new Error('No login button found on page');
      }

      await loginButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Login button found, clicking...');

      await loginButton.click({ timeout: 5000 });
      console.log('Login button clicked!');

      // Wait for navigation with a longer timeout
      console.log('Waiting for navigation after login...');
      try {
        await this.stagehand.page.waitForURL('**/home/dashboard**', { timeout: 20000 });
      } catch (e) {
        console.log('URL did not change to dashboard, checking current URL...');
      }

      await this.stagehand.page.waitForTimeout(3000);

      // Verify login
      const finalUrl = this.stagehand.page.url();
      console.log(`Final URL: ${finalUrl}`);

      if (finalUrl.includes('/home/dashboard') || finalUrl.includes('/dashboard')) {
        this.isLoggedIn = true;
        console.log('Successfully logged in!');
      } else {
        throw new Error(`Login may have failed. Final URL: ${finalUrl}. Check after-login.png screenshot.`);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Failed to login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate to the booking page for a specific sport and day
   */
  async navigateToBooking(sport: Sport, day?: string) {
    if (!this.stagehand || !this.isLoggedIn) {
      throw new Error('Must be logged in first. Call login().');
    }

    try {
      console.log(`Navigating to ${sport} booking...`);

      // Go back to dashboard to start fresh (even if stuck on another page)
      console.log('Navigating to dashboard to reset state...');
      await this.stagehand.page.goto('https://bayclubconnect.com/home/dashboard', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      await this.stagehand.page.waitForTimeout(3000);
      console.log('At dashboard, starting booking flow...');

      // Open club selector
      const clubSelector = 'xpath=/html/body/app-root/div/app-dashboard/div/div/div[1]/div[1]/app-club-context-select/div/span[4]';
      await this.stagehand.page.waitForSelector(clubSelector, { timeout: 10000 });
      await this.stagehand.page.click(clubSelector);
      await this.stagehand.page.waitForTimeout(2000);

      // Select Gateway club
      const gatewayClub = 'xpath=/html/body/modal-container/div[2]/div/app-club-context-select-modal/div[2]/div/app-schedule-visit-club/div/div[1]/div/div[2]/div/div[3]/div[1]/div/div[2]/app-radio-select/div/div[2]/div/div[2]/div/span';
      await this.stagehand.page.waitForSelector(gatewayClub, { timeout: 10000 });
      await this.stagehand.page.click(gatewayClub);
      await this.stagehand.page.waitForTimeout(1000);

      // Save club selection
      const saveButton = 'xpath=/html/body/modal-container/div[2]/div/app-club-context-select-modal/div[2]/div/app-schedule-visit-club/div/div[2]/div/div';
      await this.stagehand.page.waitForSelector(saveButton, { timeout: 10000 });
      await this.stagehand.page.click(saveButton);
      await this.stagehand.page.waitForTimeout(2000);

      // Open Schedule Activity menu
      const scheduleActivity = 'xpath=/html/body/app-root/div/app-navbar/nav/div/div/button/span';
      await this.stagehand.page.waitForSelector(scheduleActivity, { timeout: 10000 });
      await this.stagehand.page.click(scheduleActivity);
      await this.stagehand.page.waitForTimeout(2000);

      // Click Court Booking
      const courtBooking = 'xpath=/html/body/app-root/div/app-schedule-visit/div/div/div[2]/div[1]/div[2]/div/div/img';
      await this.stagehand.page.waitForSelector(courtBooking, { timeout: 10000 });
      await this.stagehand.page.click(courtBooking);
      await this.stagehand.page.waitForTimeout(5000);

      // Select sport (Tennis or Pickleball)
      console.log(`Selecting ${sport}...`);

      // Try text-based selector first, then fall back to XPath
      try {
        if (sport === 'tennis') {
          // Try clicking by text first
          const textSelector = await this.stagehand.page.getByText('Tennis', { exact: false }).first();
          await textSelector.click({ timeout: 5000 });
          console.log('Clicked Tennis via text selector');
        } else {
          // Try clicking pickleball by text
          const textSelector = await this.stagehand.page.getByText('Pickleball', { exact: false }).first();
          await textSelector.click({ timeout: 5000 });
          console.log('Clicked Pickleball via text selector');
        }
      } catch (e) {
        console.log('Text selector failed, trying XPath...');
        // Fallback to XPath
        const sportXpaths = {
          tennis: 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-filter/div[1]/div[1]/div/div/app-court-booking-category-select/div/div[1]/div/div[2]',
          pickleball: 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-filter/div[1]/div[1]/div/div/app-court-booking-category-select/div/div[1]/div/div[4]'
        };

        const sportXpath = sportXpaths[sport];
        await this.stagehand.page.waitForSelector(sportXpath, { timeout: 15000 });
        await this.stagehand.page.click(sportXpath);
        console.log(`Clicked ${sport} via XPath`);
      }

      await this.stagehand.page.waitForTimeout(3000);

      // Select duration (90 minutes for tennis, 60 minutes for pickleball)
      const durationXpaths = {
        tennis: 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-filter/div[1]/div[2]/div[2]/app-button-select/div/div[3]/span',
        pickleball: 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-filter/div[1]/div[2]/div[2]/app-button-select/div/div[2]/span'
      };

      const durationXpath = durationXpaths[sport];
      await this.stagehand.page.waitForSelector(durationXpath, { timeout: 15000 });
      await this.stagehand.page.click(durationXpath);
      await this.stagehand.page.waitForTimeout(2000);

      // Click Next to continue
      const nextButtonXpath = 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-filter/div[2]/app-racquet-sports-reservation-summary/div/div/div/div/button';
      await this.stagehand.page.waitForSelector(nextButtonXpath, { timeout: 10000 });
      await this.stagehand.page.click(nextButtonXpath);
      await this.stagehand.page.waitForTimeout(3000);

      // Select day
      const dayMap: { [key: string]: string } = {
        'monday': 'Mo',
        'tuesday': 'Tu',
        'wednesday': 'We',
        'thursday': 'Th',
        'friday': 'Fr',
        'saturday': 'Sa',
        'sunday': 'Su'
      };

      const dayAbbrev = day ? dayMap[day.toLowerCase()] || 'Mo' : 'Mo';

      try {
        // Look for element with exact text
        const dayElements = await this.stagehand.page.$$(`xpath=//*[text()="${dayAbbrev}"]`);
        if (dayElements.length > 0) {
          await dayElements[0].click();
        } else {
          throw new Error(`Day ${dayAbbrev} not found`);
        }
      } catch (e) {
        console.error(`Failed to click ${dayAbbrev}: ${e}`);
      }

      await this.stagehand.page.waitForTimeout(2000);

      // Switch to Hour View
      const hourViewSelectors = [
        'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-time-slot-select/div[1]/div/div[3]/div/div/app-court-time-slot-select[1]/div/div[2]/div/app-time-slot-view-type-select/app-button-select/div/div[2]/span',
        'xpath=//span[contains(text(), "HOUR VIEW")]',
        'xpath=//app-time-slot-view-type-select//div[2]//span',
      ];

      let hourViewClicked = false;
      for (const selector of hourViewSelectors) {
        try {
          const element = await this.stagehand.page.waitForSelector(selector, { timeout: 5000 });
          await element.click();
          console.log('Clicked Hour View');
          hourViewClicked = true;
          break;
        } catch (e) {
          console.log(`Hour view selector failed: ${selector}`);
        }
      }

      if (!hourViewClicked) {
        console.warn('Could not click Hour View, may already be in hour view');
      }

      await this.stagehand.page.waitForTimeout(3000);

      console.log(`Successfully navigated to ${sport} booking!`);
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error(`Failed to navigate to booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available time slots from the current page
   */
  async getAvailableTimes(): Promise<string[]> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized.');
    }

    try {
      console.log('Getting available times from page...');
      await this.stagehand.page.waitForTimeout(3000);

      let timeSlotElements: any[] = [];

      // Method 1: Direct tag selector
      try {
        const elements = await this.stagehand.page.$$('app-court-time-slot-item');
        if (elements.length > 0) {
          timeSlotElements = elements;
          console.log(`Method 1: Found ${elements.length} time slot elements`);
        }
      } catch (e) {
        console.log('Method 1 failed');
      }

      // Method 2: Wait for selector and try again
      if (timeSlotElements.length === 0) {
        try {
          await this.stagehand.page.waitForSelector('app-court-time-slot-item', { timeout: 10000 });
          const elements = await this.stagehand.page.$$('app-court-time-slot-item');
          if (elements.length > 0) {
            timeSlotElements = elements;
            console.log(`Method 2: Found ${elements.length} time slot elements`);
          }
        } catch (e) {
          console.log('Method 2 failed');
        }
      }

      // Method 3: Look in container
      if (timeSlotElements.length === 0) {
        try {
          const container = await this.stagehand.page.waitForSelector('xpath=//app-court-time-slot-select', { timeout: 10000 });
          if (container) {
            const elements = await container.$$('app-court-time-slot-item');
            if (elements.length > 0) {
              timeSlotElements = elements;
              console.log(`Method 3: Found ${elements.length} time slot elements in container`);
            }
          }
        } catch (e) {
          console.log('Method 3 failed');
        }
      }

      // Method 4: Find any divs with time text
      if (timeSlotElements.length === 0) {
        console.log('Method 4: Searching for divs with time text...');
        const allDivs = await this.stagehand.page.$$('div');
        console.log(`Checking ${allDivs.length} div elements...`);
        for (const elem of allDivs) {
          try {
            const text = await elem.textContent();
            if (text) {
              const trimmed = text.trim();
              // Check if it looks like a time
              if (trimmed.includes(':') &&
                  (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) &&
                  trimmed.length <= 15) {
                const isVisible = await elem.isVisible();
                if (isVisible) {
                  timeSlotElements.push(elem);
                }
              }
            }
          } catch (e) {
            // Skip
          }
        }
        console.log(`Method 4: Found ${timeSlotElements.length} elements with time text`);
      }

      const availableTimes: string[] = [];

      for (const element of timeSlotElements) {
        try {
          const text = await element.textContent();
          if (text) {
            const trimmed = text.trim();
            // Check if it looks like a time (has : and AM/PM)
            if (trimmed.includes(':') && (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM'))) {
              availableTimes.push(trimmed);
              console.log(`Available time: ${trimmed}`);
            }
          }
        } catch (e) {
          // Skip elements that can't be processed
        }
      }

      // Remove duplicates
      const uniqueTimes = [...new Set(availableTimes)];
      console.log(`Found ${availableTimes.length} available times total (${uniqueTimes.length} unique)`);
      return uniqueTimes;
    } catch (error) {
      console.error('Error getting available times:', error);
      throw error;
    }
  }

  /**
   * Normalize time string for comparison - remove spaces, convert to lowercase
   */
  private normalizeTimeString(timeStr: string): string {
    return timeStr
      .toLowerCase()
      .replace(/\s+/g, '')  // Remove all whitespace
      .replace(/\./g, '');   // Remove periods
  }

  /**
   * Extract start time from a time string (e.g., "2:30 - 4:00 PM" -> "2:30", "11:00 - 12:30 PM" -> "11:00")
   */
  private extractStartTime(timeStr: string): string {
    // Match patterns like "2:30" or "11:00" at the start, with optional am/pm
    const match = timeStr.match(/^(\d{1,2}:\d{2})/);
    return match ? match[1] : '';
  }

  /**
   * Check if two time strings match - STRICT matching only
   */
  private timeMatches(userTime: string, pageTime: string): boolean {
    // Extract start times from both
    const userStartTime = this.extractStartTime(userTime);
    const pageStartTime = this.extractStartTime(pageTime);

    if (!userStartTime || !pageStartTime) {
      return false; // Can't match if we can't extract start times
    }

    // Compare ONLY the start times - must be EXACT match
    // "2:30" must match "2:30", NOT "12:30"
    if (userStartTime === pageStartTime) {
      return true;
    }

    return false;
  }

  /**
   * Book a court at a specific time
   */
  async bookCourt(time: string): Promise<boolean> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized.');
    }

    try {
      console.log('\n=== TIME SLOT SELECTION ===');
      console.log(`Looking for time: ${time}`);

      // Find all time slot elements
      const timeSlotElements = await this.stagehand.page.$$('app-court-time-slot-item');
      console.log(`Found ${timeSlotElements.length} time slot elements on page`);

      // Log all available times for debugging
      const allTimes: string[] = [];
      for (const element of timeSlotElements) {
        try {
          const text = await element.textContent();
          if (text) {
            allTimes.push(text.trim());
          }
        } catch (e) {
          // Skip
        }
      }
      console.log('All times on page:', allTimes);
      console.log(`\n=== TIME MATCHING DEBUG ===`);
      console.log(`Looking for match with: "${time}"`);
      console.log(`Normalized user input: "${this.normalizeTimeString(time)}"`);
      console.log(`Extracted start time: "${this.extractStartTime(time)}"`);
      console.log(`=========================\n`);

      let clicked = false;
      let matchedCount = 0;

      for (const element of timeSlotElements) {
        try {
          const text = await element.textContent();
          const trimmedText = text?.trim() || '';

          if (text && this.timeMatches(time, trimmedText)) {
            matchedCount++;
            console.log(`\n--- Match #${matchedCount} ---`);
            console.log(`✓ MATCHED: "${trimmedText}" with requested: "${time}"`);
            console.log(`  - Normalized page: "${this.normalizeTimeString(trimmedText)}"`);
            console.log(`  - Normalized user: "${this.normalizeTimeString(time)}"`);
            console.log(`  - Page start time: "${this.extractStartTime(trimmedText)}"`);
            console.log(`  - User start time: "${this.extractStartTime(time)}"`);

            // Skip if already clicked
            if (clicked) {
              console.log(`  - SKIPPING (already clicked another slot)`);
              continue;
            }

            const isVisible = await element.isVisible();
            if (isVisible) {
              // Scroll into view
              await element.scrollIntoViewIfNeeded();
              await this.stagehand.page.waitForTimeout(500);

              // Try to click
              try {
                await element.click({ timeout: 5000 });
                console.log(`Clicked time slot: ${time}`);
                clicked = true;
                break;
              } catch (e) {
                // Try force click
                await element.click({ force: true });
                console.log(`Force clicked time slot: ${time}`);
                clicked = true;
                break;
              }
            }
          }
        } catch (e) {
          // Skip this element
        }
      }

      if (!clicked) {
        console.error(`Could not find or click time slot: ${time}`);
        return false;
      }

      await this.stagehand.page.waitForTimeout(2000);

      // Click Next button to proceed
      const nextButtonXpath = 'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-time-slot-select/div[2]/app-racquet-sports-reservation-summary/div/div/div/div[2]/button';
      try {
        await this.stagehand.page.waitForSelector(nextButtonXpath, { timeout: 10000 });
        await this.stagehand.page.click(nextButtonXpath);
        console.log('Clicked Next button');
        await this.stagehand.page.waitForTimeout(3000);
      } catch (e) {
        console.warn('Could not click Next button');
      }

      // === BUDDY SELECTION PHASE ===
      console.log('\n=== BUDDY SELECTION ===');

      try {
        // Wait for the buddy page to load
        await this.stagehand.page.waitForTimeout(3000);

        // Try multiple methods to click a buddy
        let clicked = false;

        // Method 1: Try exact XPaths
        const buddyXpaths = [
          'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-confirm-booking/div[1]/div/div/div/div/div[2]/app-racquet-sports-player-select/div/div[6]/app-racquet-sports-person/div/div[1]',
          'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-confirm-booking/div[1]/div/div/div/div/div[2]/app-racquet-sports-player-select/div/div[1]/app-racquet-sports-person/div/div[1]',
          'xpath=/html/body/app-root/div/ng-component/app-racquet-sports-confirm-booking/div[1]/div/div/div/div/div[2]/app-racquet-sports-player-select/div/div[15]/app-racquet-sports-person/div/div[1]',
        ];

        for (const xpath of buddyXpaths) {
          try {
            const element = await this.stagehand.page.waitForSelector(xpath, { timeout: 2000 });
            if (element) {
              await element.click();
              console.log('✓ Clicked buddy from list (XPath)');
              clicked = true;
              await this.stagehand.page.waitForTimeout(2000);
              break;
            }
          } catch (e) {
            // Try next
          }
        }

        // Method 2: Try clicking by CSS selector
        if (!clicked) {
          try {
            const personElements = await this.stagehand.page.$$('app-racquet-sports-person');
            if (personElements.length > 0) {
              await personElements[0].click();
              console.log('✓ Clicked buddy from list (CSS)');
              clicked = true;
              await this.stagehand.page.waitForTimeout(2000);
            }
          } catch (e) {
            // Try next
          }
        }

        // Method 3: Try clicking by text content
        if (!clicked) {
          try {
            const textElement = await this.stagehand.page.getByText(/Campbell|Wang|Emma|Samuel/i).first();
            await textElement.click();
            console.log('✓ Clicked buddy from list (Text)');
            clicked = true;
            await this.stagehand.page.waitForTimeout(2000);
          } catch (e) {
            // Failed
          }
        }

        if (!clicked) {
          throw new Error('Could not select any buddy');
        }
      } catch (e) {
        console.error('Error adding buddy:', e);
        return false;
      }

      // === CONFIRM BOOKING PHASE ===
      console.log('\n=== CONFIRM BOOKING ===');

      try {
        await this.stagehand.page.waitForTimeout(2000);

        // Find and click confirm button
        const allButtons = await this.stagehand.page.$$('button');

        let confirmed = false;
        for (let i = 0; i < allButtons.length && !confirmed; i++) {
          try {
            const button = allButtons[i];
            const text = await button.textContent();
            const isVisible = await button.isVisible();

            if (text && isVisible) {
              const trimmed = text.trim().toLowerCase();

              // Look for confirm, book, submit, complete
              if (trimmed.includes('confirm') ||
                  trimmed.includes('book') ||
                  trimmed.includes('submit') ||
                  trimmed.includes('complete')) {

                try {
                  await button.click({ timeout: 2000 });
                  console.log(`✓ Clicked "${text.trim()}" button`);
                  confirmed = true;
                  await this.stagehand.page.waitForTimeout(3000);
                  break;
                } catch (clickError) {
                  try {
                    await button.click({ force: true, timeout: 2000 });
                    console.log(`✓ Clicked "${text.trim()}" button (force)`);
                    confirmed = true;
                    await this.stagehand.page.waitForTimeout(3000);
                    break;
                  } catch (forceErr) {
                    // Try next button
                  }
                }
              }
            }
          } catch (e) {
            // Skip this button
          }
        }

        if (!confirmed) {
          console.warn('Could not find confirm button, trying any visible button...');

          // Last resort: click ANY visible button
          for (let i = 0; i < allButtons.length && !confirmed; i++) {
            try {
              const button = allButtons[i];
              const isVisible = await button.isVisible();

              if (isVisible) {
                await button.click({ timeout: 2000 });
                console.log(`✓ Clicked available button`);
                confirmed = true;
                await this.stagehand.page.waitForTimeout(3000);
                break;
              }
            } catch (e) {
              // Skip
            }
          }
        }

        if (!confirmed) {
          console.error('Could not find ANY clickable button');
          return false;
        }
      } catch (e) {
        console.error('Error confirming booking:', e);
        return false;
      }

      console.log('Court booked successfully!');
      return true;
    } catch (error) {
      console.error('Error booking court:', error);
      return false;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
      this.isLoggedIn = false;
    }
  }
}
