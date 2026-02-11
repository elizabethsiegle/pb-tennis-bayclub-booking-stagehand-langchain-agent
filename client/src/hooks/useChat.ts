import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Message {
  from: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

// Generate or retrieve a persistent session ID
function getSessionId(): string {
  let sessionId = localStorage.getItem('chat_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('chat_session_id', sessionId);
  }
  return sessionId;
}

export function useChat() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<string>('Connecting...');
  const sessionIdRef = useRef<string>(getSessionId());

  useEffect(() => {
    // In production, connect to the same host; in development, use localhost:3000
    const socketUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';
    const sessionId = sessionIdRef.current;
    
    const newSocket = io(socketUrl, {
      // Match server timeout settings for long-running operations
      timeout: 120000,      // 2 minutes connection timeout
      reconnection: true,   // Enable reconnection
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Send session ID as auth
      auth: { sessionId },
    });

    newSocket.on('connect', () => {
      console.log('Connected to server, socket ID:', newSocket.id, 'session:', sessionId);
      setIsConnected(true);
      // Request any pending messages for this session
      newSocket.emit('get_pending', { sessionId });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server, reason:', reason);
      setIsConnected(false);
      setStatus('Disconnected - Reconnecting...');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setStatus('Reconnected! You may need to resend your last message.');
    });

    newSocket.on('ready', () => {
      setStatus('Ready');
    });

    newSocket.on('status', (statusMessage: string) => {
      // Only update the status bar, don't add to chat messages
      setStatus(statusMessage);
    });

    newSocket.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('typing', (isTyping: boolean) => {
      setIsTyping(isTyping);
    });

    newSocket.on('error', (error: string) => {
      setMessages((prev) => [
        ...prev,
        {
          from: 'system',
          text: `Error: ${error}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !isConnected) {
        console.error('Cannot send message: not connected');
        return;
      }

      // Add user message to chat
      const userMessage: Message = {
        from: 'user',
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Send to server
      socket.emit('message', { message: text });
    },
    [socket, isConnected]
  );

  return {
    messages,
    sendMessage,
    isConnected,
    isTyping,
    status,
  };
}
