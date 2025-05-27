import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import './VideoPlayer.css';

function VideoPlayer({ videoUrl, onVideoEnd, onStateChange }) {
  const playerRef = useRef(null);

  useEffect(() => {
    // Function to handle messages from the YouTube iframe
    const handleMessage = (event) => {
      // Only handle messages from YouTube
      if (event.origin !== "https://www.youtube.com") return;
      
      try {
        // Check if the message is about a suggested video click
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          if (data.event === 'infoDelivery' && data.info && data.info.videoUrl) {
            // Extract video ID from the clicked suggestion URL
            const url = new URL(data.info.videoUrl);
            const videoId = url.searchParams.get('v');
            if (videoId) {
              // Update the video URL in your app
              const newUrl = `https://www.youtube.com/watch?v=${videoId}`;
              if (onStateChange) {
                onStateChange(newUrl);
              }
              event.preventDefault();
            }
          }
        }
      } catch (err) {
        console.error('Error handling YouTube message:', err);
      }
    };

    // Add message listener
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onStateChange]);

  const extractVideoId = (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      } else if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
      }
      return null;
    } catch {
      return null;
    }
  };

  const videoId = extractVideoId(videoUrl);

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      rel: 1, // Show related videos
      modestbranding: 1,
      enablejsapi: 1 // Enable JavaScript API
    }
  };

  const onReady = (event) => {
    playerRef.current = event.target;
  };

  const onEnd = () => {
    if (onVideoEnd) {
      onVideoEnd();
    }
  };

  if (!videoId) {
    return (
      <div className="video-placeholder">
        <p>Enter a YouTube URL to start watching</p>
      </div>
    );
  }

  return (
    <div className="video-player">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        onEnd={onEnd}
        className="youtube-player"
      />
    </div>
  );
}

export default VideoPlayer; 