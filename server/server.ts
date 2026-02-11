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

// Debug logging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isProduction:', isProduction);
console.log('__dirname:', __dirname);

// In production, serve static files from client/dist
// Path varies based on where server runs from
const clientDistPath = isProduction 
  ? resolve(__dirname, '../../client/dist')  // From server/dist -> ../../client/dist
  : null;

console.log('clientDistPath:', clientDistPath);

if (isProduction && clientDistPath) {
  console.log('Serving static files from:', clientDistPath);
}

const io = new Server(httpServer, {
  cors: {
    origin: isProduction ? undefined : 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  // Increase timeouts for long-running operations (Stagehand can take 60+ seconds)
  pingTimeout: 120000,  // 2 minutes
  pingInterval: 25000,  // 25 seconds
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client build in production
if (isProduction && clientDistPath) {
  app.use(express.static(clientDistPath));
}

// Store agents per session (not socket) for persistence across reconnections
const sessions = new Map<string, {
  agent: BookingAgent;
  socketId: string | null;
  pendingMessages: Array<{ from: string; text: string; timestamp: string }>;
  isProcessing: boolean;
}>();

// Map socket IDs to session IDs for quick lookup
const socketToSession = new Map<string, string>();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes in production (SPA support)
if (isProduction && clientDistPath) {
  app.get('*', (req, res) => {
    res.sendFile(resolve(clientDistPath, 'index.html'));
  });
}

// Helper to send message to session (finds current socket)
function sendToSession(sessionId: string, event: string, data: unknown) {
  const session = sessions.get(sessionId);
  if (!session || !session.socketId) return false;
  
  const socket = io.sockets.sockets.get(session.socketId);
  if (socket && socket.connected) {
    socket.emit(event, data);
    return true;
  }
  return false;
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  const sessionId = socket.handshake.auth?.sessionId as string;
  console.log(`Client connected: ${socket.id}, session: ${sessionId || 'none'}`);

  if (!sessionId) {
    socket.emit('error', 'No session ID provided');
    socket.disconnect();
    return;
  }

  // Check if we have an existing session
  let session = sessions.get(sessionId);
  
  if (session) {
    // Reconnecting to existing session
    console.log(`Resuming session ${sessionId} (was socket ${session.socketId})`);
    
    // Update socket mapping
    if (session.socketId) {
      socketToSession.delete(session.socketId);
    }
    session.socketId = socket.id;
    socketToSession.set(socket.id, sessionId);
    
    // Send ready status
    if (session.isProcessing) {
      socket.emit('status', 'Processing your request...');
      socket.emit('typing', true);
    } else {
      socket.emit('status', 'Reconnected! Ready to help.');
      socket.emit('ready');
    }
    
    // Deliver any pending messages
    if (session.pendingMessages.length > 0) {
      console.log(`Delivering ${session.pendingMessages.length} pending messages to session ${sessionId}`);
      for (const msg of session.pendingMessages) {
        socket.emit('message', msg);
      }
      session.pendingMessages = [];
      socket.emit('typing', false);
    }
  } else {
    // New session - initialize agent
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const username = process.env.BAYCLUB_USERNAME;
      const password = process.env.BAYCLUB_PASSWORD;

      if (!apiKey || !username || !password) {
        socket.emit('error', 'Server configuration error: Missing credentials');
        return;
      }

      socket.emit('status', 'Initializing booking agent...');

      const agent = new BookingAgent(apiKey, username, password);
      await agent.initialize();
      
      session = {
        agent,
        socketId: socket.id,
        pendingMessages: [],
        isProcessing: false,
      };
      sessions.set(sessionId, session);
      socketToSession.set(socket.id, sessionId);

      socket.emit('status', 'Connected! Ask me to book a tennis or pickleball court.');
      socket.emit('ready');

      console.log(`New session ${sessionId} initialized for socket ${socket.id}`);
    } catch (error) {
      console.error(`Error initializing agent for session ${sessionId}:`, error);
      socket.emit('error', 'Failed to initialize booking agent');
      return;
    }
  }

  // Handle request for pending messages (on reconnect)
  socket.on('get_pending', ({ sessionId: reqSessionId }) => {
    const sess = sessions.get(reqSessionId);
    if (sess && sess.pendingMessages.length > 0) {
      console.log(`Delivering ${sess.pendingMessages.length} pending messages on request`);
      for (const msg of sess.pendingMessages) {
        socket.emit('message', msg);
      }
      sess.pendingMessages = [];
      socket.emit('typing', false);
    }
  });

  // Handle incoming messages
  socket.on('message', async (data: { message: string }) => {
    const sessId = socketToSession.get(socket.id);
    if (!sessId) {
      socket.emit('error', 'Session not found');
      return;
    }
    
    const sess = sessions.get(sessId);
    if (!sess) {
      socket.emit('error', 'Session not found');
      return;
    }

    console.log(`Message from session ${sessId} (socket ${socket.id}):`, data.message);

    try {
      // Mark as processing and emit typing indicator
      sess.isProcessing = true;
      socket.emit('typing', true);

      // Process message through agent
      const response = await sess.agent.chat(data.message);
      sess.isProcessing = false;

      const responseMsg = {
        from: 'assistant',
        text: response,
        timestamp: new Date().toISOString()
      };

      // Try to send to current socket for this session
      if (!sendToSession(sessId, 'message', responseMsg)) {
        // Socket disconnected - store as pending
        console.log(`Session ${sessId} socket disconnected, storing response as pending`);
        sess.pendingMessages.push(responseMsg);
      } else {
        sendToSession(sessId, 'typing', false);
      }
    } catch (error) {
      console.error(`Error processing message for session ${sessId}:`, error);
      sess.isProcessing = false;
      if (!sendToSession(sessId, 'error', 'Failed to process message')) {
        sess.pendingMessages.push({
          from: 'system',
          text: 'Error: Failed to process message',
          timestamp: new Date().toISOString()
        });
      }
      sendToSession(sessId, 'typing', false);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async (reason) => {
    const sessId = socketToSession.get(socket.id);
    console.log(`Client disconnected: ${socket.id}, session: ${sessId}, reason: ${reason}`);

    if (sessId) {
      const sess = sessions.get(sessId);
      if (sess) {
        // Don't delete session - keep it for reconnection
        // Just clear the socket reference
        sess.socketId = null;
        
        // Set a timeout to clean up abandoned sessions (5 minutes)
        setTimeout(async () => {
          const currentSess = sessions.get(sessId);
          if (currentSess && currentSess.socketId === null) {
            console.log(`Cleaning up abandoned session ${sessId}`);
            try {
              await currentSess.agent.cleanup();
            } catch (error) {
              console.error(`Error cleaning up agent for session ${sessId}:`, error);
            }
            sessions.delete(sessId);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
      socketToSession.delete(socket.id);
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

  // Cleanup all sessions
  for (const [sessionId, session] of sessions.entries()) {
    try {
      await session.agent.cleanup();
      console.log(`Cleaned up session ${sessionId}`);
    } catch (error) {
      console.error(`Error cleaning up session ${sessionId}:`, error);
    }
  }

  process.exit(0);
});
