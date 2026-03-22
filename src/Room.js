import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import ReactPlayer from "react-player";
import Chat from "./Chat";
import VideoSuggestions from "./VideoSuggestions";
import YouTubeSearch from "./YouTubeSearch";
import "./styles.css";

// Create socket connection outside component to prevent multiple connections
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: false // Prevent auto connection
});

// Add socket error handling
socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});

socket.on("connect", () => {
  console.log("Socket connected successfully");
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});

function Room() {
  const { roomCode } = useParams();
  const [videoUrl, setVideoUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isFullscreenChatOpen, setIsFullscreenChatOpen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const playerRef = useRef(null);
  const videoContainerRef = useRef(null);
  const hasInitializedMessagesRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const currentUser = localStorage.getItem("userName") || "Anonymous";

  useEffect(() => {
    // Connect socket when component mounts
    socket.connect();

    // Set up socket event listeners
    socket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
      socket.emit("join-room", roomCode);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("sync-video", ({ action, time }) => {
      console.log("Received sync-video:", action, time);
      if (playerRef.current) {
        if (action === "play") {
          setPlaying(true);
          playerRef.current.seekTo(time, "seconds");
        } else if (action === "pause") {
          setPlaying(false);
          playerRef.current.seekTo(time, "seconds");
        }
      }
    });

    socket.on("update-video-url", (url) => {
      console.log("Received new video URL:", url);
      setVideoUrl(url);
    });

    // Cleanup on unmount
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("sync-video");
      socket.off("update-video-url");
      socket.disconnect();
    };
  }, [roomCode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement;
      const container = videoContainerRef.current;
      const isFullscreenVideo =
        !!fullscreenElement &&
        !!container &&
        (fullscreenElement === container || container.contains(fullscreenElement));
      setIsVideoFullscreen(isFullscreenVideo);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isVideoFullscreen) {
      setIsFullscreenChatOpen(false);
    }
  }, [isVideoFullscreen]);

  useEffect(() => {
    const currentCount = chatMessages.length;

    // Skip auto-open on initial history hydration.
    if (!hasInitializedMessagesRef.current) {
      hasInitializedMessagesRef.current = true;
      previousMessageCountRef.current = currentCount;
      return;
    }

    if (
      isVideoFullscreen &&
      !isFullscreenChatOpen &&
      currentCount > previousMessageCountRef.current
    ) {
      setIsFullscreenChatOpen(true);
    }

    previousMessageCountRef.current = currentCount;
  }, [chatMessages, isVideoFullscreen, isFullscreenChatOpen]);

  const handlePlay = () => {
    if (playerRef.current && isConnected) {
      const currentTime = playerRef.current.getCurrentTime();
      console.log("Emitting play at time:", currentTime);
      socket.emit("video-action", { roomCode, action: "play", time: currentTime });
      setPlaying(true);
    }
  };

  const handlePause = () => {
    if (playerRef.current && isConnected) {
      const currentTime = playerRef.current.getCurrentTime();
      console.log("Emitting pause at time:", currentTime);
      socket.emit("video-action", { roomCode, action: "pause", time: currentTime });
      setPlaying(false);
    }
  };

  const handleProgress = (state) => {
    // Sync if the difference is more than 2 seconds
    if (playerRef.current && isConnected && playing) {
      const currentTime = playerRef.current.getCurrentTime();
      if (Math.abs(currentTime - state.playedSeconds) > 2) {
        socket.emit("video-action", { roomCode, action: "play", time: currentTime });
      }
    }
  };

  const handleUrlChange = (url) => {
    setVideoUrl(url);
    if (isConnected) {
      console.log("Emitting new video URL:", url);
      socket.emit("change-video-url", { roomCode, url });
    }
  };

  const toggleVideoFullscreen = async () => {
    const container = videoContainerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
    }
  };

  const getCommentOpacityClass = (indexFromEnd) => {
    if (indexFromEnd <= 1) return "live-comment-strong";
    if (indexFromEnd === 2) return "live-comment-medium";
    if (indexFromEnd === 3) return "live-comment-soft";
    return "live-comment-faint";
  };

  const recentLiveMessages = chatMessages.slice(-6);

  const sendFullscreenMessage = (event) => {
    event.preventDefault();
    const trimmedMessage = fullscreenMessage.trim();
    if (!trimmedMessage || !isConnected) return;

    const messageData = {
      roomCode,
      message: trimmedMessage,
      sender: currentUser,
      timestamp: new Date().toISOString(),
      socketId: socket.id
    };

    socket.emit("chat-message", messageData);
    setChatMessages((prev) => [...prev, { ...messageData, isCurrentUser: true }]);
    setFullscreenMessage("");
  };

  return (
    <div className="room-container">
      <h2>Room Code: {roomCode}</h2>
      <div className="room-content">
        <div className="side-panel">
          <Chat socket={socket} roomCode={roomCode} onMessagesChange={setChatMessages} />
        </div>
        
        <div className="main-content">
          <YouTubeSearch 
            onVideoSelect={handleUrlChange}
            currentVideoUrl={videoUrl}
          />
          <div className="video-container" ref={videoContainerRef}>
            <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              playing={playing}
              controls
              width="100%"
              height="100%"
              onPlay={handlePlay}
              onPause={handlePause}
              onProgress={handleProgress}
              config={{
                youtube: {
                  playerVars: {
                    modestbranding: 1,
                    controls: 1,
                    fs: 0
                  }
                }
              }}
            />
            <button
              type="button"
              className="video-fullscreen-toggle"
              onClick={toggleVideoFullscreen}
            >
              {isVideoFullscreen ? "Exit Fullscreen" : "Fullscreen Chat Mode"}
            </button>
            {isVideoFullscreen && (
              <button
                type="button"
                className="fullscreen-chat-toggle"
                onClick={() => setIsFullscreenChatOpen((prev) => !prev)}
              >
                {isFullscreenChatOpen ? "Hide Chat" : "Open Chat"}
              </button>
            )}
            {isVideoFullscreen && isFullscreenChatOpen && recentLiveMessages.length > 0 && (
              <div className="live-chat-overlay" aria-live="polite">
                {recentLiveMessages.map((msg, index) => {
                  const indexFromEnd = recentLiveMessages.length - 1 - index;
                  return (
                    <div
                      key={`overlay-${msg.timestamp || index}-${index}`}
                      className={`live-comment ${getCommentOpacityClass(indexFromEnd)}`}
                    >
                      <span className="live-comment-sender">{msg.sender}:</span>{" "}
                      <span>{msg.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {isVideoFullscreen && isFullscreenChatOpen && (
              <form className="fullscreen-chat-composer" onSubmit={sendFullscreenMessage}>
                <input
                  type="text"
                  className="fullscreen-chat-input"
                  placeholder={isConnected ? "Send a message..." : "Reconnecting..."}
                  value={fullscreenMessage}
                  onChange={(e) => setFullscreenMessage(e.target.value)}
                  disabled={!isConnected}
                />
                <button
                  type="submit"
                  className="fullscreen-chat-send"
                  disabled={!isConnected || !fullscreenMessage.trim()}
                >
                  Send
                </button>
                <button
                  type="button"
                  className="fullscreen-chat-close"
                  onClick={() => setIsFullscreenChatOpen(false)}
                  aria-label="Close chat"
                >
                  x
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="side-panel">
          <VideoSuggestions 
            currentVideoUrl={videoUrl}
            onVideoSelect={handleUrlChange}
          />
        </div>
      </div>
    </div>
  );
}

export default Room;
