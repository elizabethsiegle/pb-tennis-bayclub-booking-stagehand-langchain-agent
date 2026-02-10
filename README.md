# Tennis Court Booking Chat App

An AI-powered conversational interface for booking tennis and pickleball courts at Bay Club Gateway using Stagehand browser automation and LangChain.

## Features

- Natural language booking interface
- Intelligent date parsing (understands "today", "tomorrow", "Wednesday", etc.)
- Real-time chat with conversation memory
- Automated browser interaction using Stagehand
- Supports both tennis (90 min) and pickleball (60 min) bookings
- Automatically adds Samuel Wang as a buddy

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, TypeScript, Vite
- **AI**: LangChain with Anthropic Claude
- **Browser Automation**: Stagehand
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ installed
- An Anthropic API key
- Bay Club Connect account credentials

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
5. **Response**: Available times or booking confirmation is sent back

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

Set `headless: true` in [server/booking/stagehand-bot.ts](server/booking/stagehand-bot.ts:17) before deploying.
