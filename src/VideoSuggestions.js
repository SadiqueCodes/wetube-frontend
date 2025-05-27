import React, { useState, useEffect } from 'react';
import './VideoSuggestions.css';

function VideoSuggestions({ currentVideoUrl, onVideoSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!currentVideoUrl) {
        setSuggestions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Extract video ID from URL
        const videoId = extractVideoId(currentVideoUrl);
        console.log('Extracted Video ID:', videoId);
        
        if (!videoId) {
          setError('Please enter a valid YouTube URL');
          return;
        }

        // Check if API key exists
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error('API key is missing from environment variables');
          setError('YouTube API key is missing');
          return;
        }

        // First verify the video exists
        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
        const videoResponse = await fetch(videoDetailsUrl);
        const videoData = await videoResponse.json();

        if (!videoResponse.ok || !videoData.items || videoData.items.length === 0) {
          console.error('Video not found:', videoData.error);
          setError('Video not found or not accessible');
          return;
        }

        // Get video category and channel ID for better related videos
        const categoryId = videoData.items[0].snippet?.categoryId;
        const channelId = videoData.items[0].snippet?.channelId;
        const videoTitle = videoData.items[0].snippet.title;
        
        // Extract artist name from title (common patterns in music videos)
        const extractArtistName = (title) => {
          // Common patterns: "Artist - Song", "Song | Artist", "Song by Artist"
          const patterns = [
            /^(.*?)\s*[-|]\s*(.*?)$/,  // Artist - Song or Song | Artist
            /^(.*?)\s+by\s+(.*?)$/i,   // Song by Artist
            /^(.*?)\s+[•·]\s+(.*?)$/   // Artist • Song
          ];
          
          for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match) {
              // Check both parts to find which one is likely the artist
              const [_, part1, part2] = match;
              // Common words that indicate the second part is the artist
              if (part1.toLowerCase().includes('by') || 
                  part1.toLowerCase().includes('ft.') ||
                  part1.toLowerCase().includes('feat')) {
                return part2.trim();
              }
              // Common words that indicate the first part is the artist
              if (part2.toLowerCase().includes('official') || 
                  part2.toLowerCase().includes('video') ||
                  part2.toLowerCase().includes('audio')) {
                return part1.trim();
              }
            }
          }
          return null;
        };

        const artistName = extractArtistName(videoTitle);
        console.log('Extracted artist name:', artistName);

        // Try to get artist-based recommendations first
        let suggestions = [];
        if (artistName) {
          const artistSearchParams = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            maxResults: '15',
            key: apiKey,
            q: `${artistName} music -"${videoTitle}"`, // Exclude current song
            videoCategoryId: categoryId || ''
          });

          const artistSearchUrl = `https://www.googleapis.com/youtube/v3/search?${artistSearchParams.toString()}`;
          console.log('Fetching artist videos...');
          
          try {
            const artistResponse = await fetch(artistSearchUrl);
            const artistData = await artistResponse.json();
            
            if (artistResponse.ok && artistData.items) {
              suggestions = artistData.items
                .filter(item => 
                  item.id?.kind === 'youtube#video' &&
                  item.id?.videoId !== videoId &&
                  item.snippet?.title &&
                  item.snippet?.thumbnails?.medium?.url
                )
                .map(item => ({
                  id: item.id.videoId,
                  title: item.snippet.title,
                  thumbnail: item.snippet.thumbnails.medium.url,
                  channelTitle: item.snippet.channelTitle || 'Unknown Channel'
                }));
            }
          } catch (err) {
            console.error('Error fetching artist videos:', err);
          }
        }

        // If artist search didn't yield enough results, add general recommendations
        if (suggestions.length < 5) {
          const generalSearchParams = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            maxResults: '10',
            key: apiKey,
            q: videoTitle.split(/[-|]|\bby\b/i)[0].trim(), // Use first part of title
            videoCategoryId: categoryId || ''
          });

          const generalSearchUrl = `https://www.googleapis.com/youtube/v3/search?${generalSearchParams.toString()}`;
          console.log('Fetching general recommendations...');
          
          const generalResponse = await fetch(generalSearchUrl);
          const generalData = await generalResponse.json();

          if (generalResponse.ok && generalData.items) {
            const generalSuggestions = generalData.items
              .filter(item => 
                item.id?.kind === 'youtube#video' &&
                item.id?.videoId !== videoId &&
                !suggestions.some(s => s.id === item.id.videoId) && // Avoid duplicates
                item.snippet?.title &&
                item.snippet?.thumbnails?.medium?.url
              )
              .map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                channelTitle: item.snippet.channelTitle || 'Unknown Channel'
              }));
            
            suggestions = [...suggestions, ...generalSuggestions];
          }
        }

        if (suggestions.length === 0) {
          setError('No related videos found');
          return;
        }

        setSuggestions(suggestions);
      } catch (err) {
        console.error('Error fetching video data:', err);
        setError(err.message || 'Failed to load video data');
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [currentVideoUrl]);

  const extractVideoId = (url) => {
    if (!url) return null;
    
    try {
      // Remove any @ symbol and clean the URL
      const cleanUrl = url.replace(/^@/, '').trim();
      const urlObj = new URL(cleanUrl);
      let videoId = null;

      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v');
      } else if (urlObj.hostname === 'youtu.be') {
        // Get the path without any query parameters
        videoId = urlObj.pathname.split('/')[1];
      }

      // Clean up the video ID and validate
      if (videoId) {
        videoId = videoId.split('?')[0].split('&')[0];
      }

      const isValidId = videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
      console.log('Extracted ID:', videoId, 'Is Valid:', isValidId);
      return isValidId ? videoId : null;
    } catch (err) {
      console.error('Invalid URL:', err);
      return null;
    }
  };

  const handleVideoClick = (videoId) => {
    const newUrl = `https://www.youtube.com/watch?v=${videoId}`;
    onVideoSelect(newUrl);
  };

  return (
    <div className="video-suggestions">
      <h3>Related Videos {loading && <span className="loading-text">Loading...</span>}</h3>
      <div className="suggestions-list">
        {error ? (
          <div className="suggestions-message error">
            <p>{error}</p>
            {error.includes('API key') && (
              <p className="error-help">
                1. Create a YouTube Data API key at Google Cloud Console<br/>
                2. Add it to .env file as REACT_APP_YOUTUBE_API_KEY=your_api_key<br/>
                3. Restart the application
              </p>
            )}
          </div>
        ) : suggestions.length === 0 && !loading ? (
          <div className="suggestions-message">
            <p>No suggestions yet</p>
            <p className="help-text">Enter a valid YouTube URL to see related videos</p>
          </div>
        ) : (
          suggestions.map((video) => (
            <div
              key={video.id}
              className="suggestion-item"
              onClick={() => handleVideoClick(video.id)}
            >
              <img src={video.thumbnail} alt={video.title} />
              <div className="suggestion-info">
                <h4>{video.title}</h4>
                <p>{video.channelTitle}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default VideoSuggestions; 