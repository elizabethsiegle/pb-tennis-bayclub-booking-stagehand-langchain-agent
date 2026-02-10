import React from 'react';
import { useChat } from '../hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatWindow.css';

function ChatWindow() {
  const { messages, sendMessage, isConnected, isTyping, status } = useChat();

  return (
    <div className="chat-window">
      <div className="chat-status">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">{status}</span>
      </div>
      <MessageList messages={messages} isTyping={isTyping} />
      <MessageInput onSend={sendMessage} disabled={!isConnected || status !== 'Ready'} />
    </div>
  );
}

export default ChatWindow;
