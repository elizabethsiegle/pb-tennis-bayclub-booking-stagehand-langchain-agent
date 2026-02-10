import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Message {
  from: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export function useChat() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<string>('Connecting...');

  useEffect(() => {
    const newSocket = io('http://localhost:3000');

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setStatus('Disconnected');
    });

    newSocket.on('ready', () => {
      setStatus('Ready');
    });

    newSocket.on('status', (statusMessage: string) => {
      setStatus(statusMessage);
      setMessages((prev) => [
        ...prev,
        {
          from: 'system',
          text: statusMessage,
          timestamp: new Date().toISOString(),
        },
      ]);
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
