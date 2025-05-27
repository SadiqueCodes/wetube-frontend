import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import ReactPlayer from "react-player";
import Chat from "./Chat";
import VideoSuggestions from "./VideoSuggestions";
import "./styles.css";

// Create socket connection outside component to prevent multiple connections
const socket = io("http://localhost:5000", {
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
  const playerRef = useRef(null);

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

  return (
    <div className="room-container">
      <h2>Room Code: {roomCode}</h2>
      <div className="room-content">
        <div className="side-panel">
          <Chat socket={socket} roomCode={roomCode} />
        </div>
        
        <div className="main-content">
          <input
            type="text"
            placeholder="Enter YouTube URL"
            value={videoUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="video-input"
          />
          <div className="video-container">
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
                    controls: 1
                  }
                }
              }}
            />
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
