import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { BookingAgent } from './chat/langchain-agent.js';

// Load environment variables
// __dirname is server/dist/ when compiled, so we need to go up two levels to reach project root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === 'production';

const io = new Server(httpServer, {
  cors: {
    origin: isProduction ? undefined : 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client build in production
// __dirname is server/dist/ when compiled, so we need to go up two levels
if (isProduction) {
  const clientDistPath = resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
}

// Store agents per socket connection
const agents = new Map<string, BookingAgent>();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes in production (SPA support)
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(resolve(__dirname, '../../client/dist/index.html'));
  });
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Initialize agent for this connection
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const username = process.env.BAYCLUB_USERNAME;
    const password = process.env.BAYCLUB_PASSWORD;

    if (!apiKey || !username || !password) {
      socket.emit('error', 'Server configuration error: Missing credentials');
      return;
    }

    const agent = new BookingAgent(apiKey, username, password);

    // Emit status update
    socket.emit('status', 'Initializing booking agent...');

    await agent.initialize();
    agents.set(socket.id, agent);

    socket.emit('status', 'Connected! Ask me to book a tennis or pickleball court.');
    socket.emit('ready');

    console.log(`Agent initialized for ${socket.id}`);
  } catch (error) {
    console.error(`Error initializing agent for ${socket.id}:`, error);
    socket.emit('error', 'Failed to initialize booking agent');
  }

  // Handle incoming messages
  socket.on('message', async (data: { message: string }) => {
    console.log(`Message from ${socket.id}:`, data.message);

    const agent = agents.get(socket.id);
    if (!agent) {
      socket.emit('error', 'Agent not initialized');
      return;
    }

    try {
      // Emit typing indicator
      socket.emit('typing', true);

      // Process message through agent
      const response = await agent.chat(data.message);

      // Emit response
      socket.emit('typing', false);
      socket.emit('message', {
        from: 'assistant',
        text: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error processing message for ${socket.id}:`, error);
      socket.emit('typing', false);
      socket.emit('error', 'Failed to process message');
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);

    const agent = agents.get(socket.id);
    if (agent) {
      try {
        await agent.cleanup();
      } catch (error) {
        console.error(`Error cleaning up agent for ${socket.id}:`, error);
      }
      agents.delete(socket.id);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');

  // Cleanup all agents
  for (const [socketId, agent] of agents.entries()) {
    try {
      await agent.cleanup();
      console.log(`Cleaned up agent for ${socketId}`);
    } catch (error) {
      console.error(`Error cleaning up agent for ${socketId}:`, error);
    }
  }

  process.exit(0);
});
