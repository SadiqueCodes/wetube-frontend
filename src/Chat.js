import React, { useEffect, useState, useRef } from "react";
import "./Chat.css";

function Chat({ socket, roomCode }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const [currentUser] = useState(localStorage.getItem("userName") || "Anonymous");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // When first connecting, send username to server
    if (socket.connected) {
      socket.emit("user-joined", { roomCode, username: currentUser });
    }

    // Handle connection status
    const handleConnect = () => {
      console.log("Chat connected");
      setIsConnected(true);
      // Send username when reconnecting
      socket.emit("user-joined", { roomCode, username: currentUser });
    };

    const handleDisconnect = () => {
      console.log("Chat disconnected");
      setIsConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    setIsConnected(socket.connected);

    // Handle chat messages
    socket.on("chat-message", (chatData) => {
      console.log("Received chat message:", chatData);
      if (chatData && chatData.message && chatData.sender) {
        setMessages((prevMessages) => [...prevMessages, {
          ...chatData,
          timestamp: chatData.timestamp || new Date().toISOString(),
          isCurrentUser: chatData.socketId === socket.id
        }]);
      }
    });

    // Handle chat history when joining room
    socket.on("chat-history", (history) => {
      console.log("Received chat history:", history);
      const processedHistory = history.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString(),
        isCurrentUser: msg.socketId === socket.id
      }));
      setMessages(processedHistory);
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat-message");
      socket.off("chat-history");
    };
  }, [socket, roomCode, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (e) => {
    e?.preventDefault();
    if (message.trim() !== "" && isConnected) {
      const messageData = {
        roomCode,
        message: message.trim(),
        sender: currentUser,
        timestamp: new Date().toISOString(),
        socketId: socket.id
      };
      console.log("Sending message:", messageData);
      socket.emit("chat-message", messageData);
      
      setMessages((prevMessages) => [...prevMessages, {
        ...messageData,
        isCurrentUser: true
      }]);
      
      setMessage("");
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="chat-container">
      <h3>
        Chat Room
        {!isConnected && <span className="connection-status">(Disconnected)</span>}
      </h3>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.timestamp}-${index}`}
              className={`chat-message ${msg.isCurrentUser ? "my-message" : "other-message"}`}
            >
              <div className="message-content">
                <strong>{msg.sender}</strong>
                <span className="message-text">{msg.message}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <form onSubmit={sendMessage}>
          <input
            type="text"
            placeholder={isConnected ? "Type a message..." : "Reconnecting..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!isConnected}
          />
          <button type="submit" disabled={!isConnected || !message.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
