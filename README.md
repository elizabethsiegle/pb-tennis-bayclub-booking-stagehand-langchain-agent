# Tennis Court Booking Chat App

An AI-powered conversational interface for booking tennis and pickleball courts at Bay Club Gateway using Stagehand browser automation and LangChain.

## Features

- Natural language booking interface
- Intelligent date parsing (understands "today", "tomorrow", "Wednesday", etc.)
- Real-time chat with conversation memory
- Automated browser interaction using Stagehand
- Supports both tennis (90 min) and pickleball (60 min) bookings
- Automatically adds Samuel Wang as a buddy
- Production-ready with DigitalOcean App Platform and Browserbase

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, TypeScript, Vite
- **AI**: LangChain with Anthropic Claude
- **Browser Automation**: Stagehand + Browserbase (cloud browsers)
- **Date Handling**: date-fns
- **Deployment**: DigitalOcean App Platform

## Prerequisites

- Node.js 18+ installed
- An Anthropic API key
- Bay Club Connect account credentials
- (For production) Browserbase account

## Setup

1. Clone the repository and navigate to the project:
   ```bash
   cd ~/Desktop/tennis-booking-chat
   ```

2. Copy the environment template and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your credentials:
   ```
   BAYCLUB_USERNAME=your_username
   BAYCLUB_PASSWORD=your_password
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on http://localhost:3000
   - Frontend on http://localhost:5173

## Google Calendar Integration (Optional)

Automatically add court bookings to your Google Calendar.

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**
4. Create a **Service Account**:
   - Go to "IAM & Admin" → "Service Accounts"
   - Create a new service account
   - Download the JSON credentials file
5. **Share your calendar** with the service account:
   - Open Google Calendar
   - Go to calendar settings → "Share with specific people"
   - Add the service account email (from the JSON file)
   - Give "Make changes to events" permission

### Local Development

Save the credentials file as `google-calendar-credentials.json` in the project root.

### Production (DigitalOcean)

Add the entire JSON content as the `GOOGLE_CALENDAR_CREDENTIALS` environment variable.

Optionally set `GOOGLE_CALENDAR_ID` to a specific calendar ID (defaults to 'primary').

## Usage

Open http://localhost:5173 in your browser and start chatting!

Example conversations:

- "Can I book a pickleball court on Wednesday?"
- "What times are available for tennis tomorrow?"
- "Book the 2pm slot"

## How It Works

1. **User Input**: You type a message in the chat interface
2. **LangChain Agent**: Claude processes your request and decides what to do
3. **Date Parsing**: Natural language dates are converted to actual dates
4. **Stagehand Automation**: Browser automation logs into Bay Club and performs actions
5. **Google Calendar**: Successful bookings are added to your calendar (if configured)
6. **Response**: Available times or booking confirmation is sent back

## Important Notes

- **Today's Date**: The system knows what day it is today
- **Browser Window**: A Chrome window will open for automation (set `headless: true` in production)
- **Session Management**: Each chat session gets its own browser instance
- **Buddy**: Samuel Wang is automatically added to all bookings

## Project Structure

```
tennis-booking-chat/
├── server/               # Backend application
│   ├── booking/         # Stagehand automation
│   ├── chat/           # LangChain agent & date parser
│   ├── tools/          # LangChain tools
│   └── server.ts       # Express + Socket.IO server
├── client/             # React frontend
│   └── src/
│       ├── components/ # React components
│       └── hooks/      # Custom hooks
└── .env                # Environment variables
```

## Troubleshooting

**Browser doesn't open**: Make sure Stagehand can access Chrome. Try running with `headless: false` first.

**Connection errors**: Ensure the backend server is running on port 3000.

**Login fails**: Double-check your Bay Club credentials in `.env`.

**Anthropic API errors**: Verify your API key is correct and has credits.

## Development

Start individual services:

```bash
# Start backend only
npm run dev:server

# Start frontend only
npm run dev:client
```

## Building for Production

```bash
npm run build
npm start
```

## Deploying to DigitalOcean App Platform

### 1. Set Up Browserbase

Since DigitalOcean doesn't have a browser installed, you need [Browserbase](https://browserbase.com) for cloud-hosted browsers:

1. Sign up at [browserbase.com](https://browserbase.com)
2. Create a new project
3. Copy your **API Key** and **Project ID**

### 2. Create DigitalOcean App

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **Create App** and connect your GitHub repository
3. Configure the app:
   - **Source**: Your GitHub repo, `main` branch
   - **Type**: Web Service
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: `3000`

### 3. Set Environment Variables

Add these environment variables in DigitalOcean App Settings:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `BAYCLUB_USERNAME` | Bay Club login username |
| `BAYCLUB_PASSWORD` | Bay Club login password |
| `BROWSERBASE_API_KEY` | Your Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Your Browserbase project ID |
| `GOOGLE_CALENDAR_CREDENTIALS` | (Optional) Google service account JSON |
| `GOOGLE_CALENDAR_ID` | (Optional) Calendar ID, defaults to 'primary' |

### 4. Deploy

Click **Deploy** and wait for the build to complete. Your app will be available at the provided URL.

### How Production Works

- In development (`NODE_ENV !== 'production'`): Uses local Chrome browser
- In production (`NODE_ENV === 'production'`): Uses Browserbase cloud browsers

The server automatically:
- Serves the React frontend from `/client/dist`
- Handles WebSocket connections for real-time chat
- Connects to Browserbase for browser automation
