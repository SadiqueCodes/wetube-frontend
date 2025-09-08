import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './YouTubeSearch.css';

const YouTubeSearch = ({ onVideoSelect, currentVideoUrl }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchTimeout = useRef(null);

  // YouTube API key
  const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchVideos = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Check if we have an API key
    if (!API_KEY) {
      console.log('No YouTube API key found');
      // Try to parse YouTube URL directly
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        handleDirectUrl(query);
      }
      return;
    }

    setIsLoading(true);
    try {
      console.log('Searching YouTube for:', query);
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          maxResults: 10,
          q: query,
          type: 'video',
          key: API_KEY,
          videoEmbeddable: true,
        }
      });

      const videos = response.data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle,
        description: item.snippet.description,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));

      setSearchResults(videos);
      setShowDropdown(true);
      console.log('Found', videos.length, 'videos');
    } catch (error) {
      console.error('Error searching YouTube:', error);
      if (error.response) {
        console.error('API Error Response:', error.response.data);
      }
      
      // Fallback: If API fails, try to parse YouTube URL directly
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        handleDirectUrl(query);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectUrl = (url) => {
    // Handle direct YouTube URL input
    if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
      onVideoSelect(url);
      setSearchQuery('');
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Debounce search
    searchTimeout.current = setTimeout(() => {
      searchVideos(value);
    }, 500);
  };

  const handleVideoSelect = (video) => {
    onVideoSelect(video.url);
    setSearchQuery(video.title);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleVideoSelect(searchResults[selectedIndex]);
      } else if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
        handleDirectUrl(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const formatDuration = (duration) => {
    // Convert ISO 8601 duration to readable format
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '';
    
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    const parts = [];
    if (hours) parts.push(hours.padStart(2, '0'));
    parts.push((minutes || '0').padStart(2, '0'));
    parts.push((seconds || '0').padStart(2, '0'));
    
    return parts.join(':');
  };

  return (
    <div className="youtube-search-container" ref={dropdownRef}>
      <div className="search-input-wrapper">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search YouTube videos or paste URL..."
          className="youtube-search-input"
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
        />
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="search-dropdown">
          {searchResults.map((video, index) => (
            <div
              key={video.id}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleVideoSelect(video)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <img 
                src={video.thumbnail} 
                alt={video.title}
                className="video-thumbnail"
              />
              <div className="video-info">
                <div className="video-title">{video.title}</div>
                <div className="video-channel">{video.channelTitle}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!API_KEY && (
        <div className="api-key-warning">
          Note: YouTube search requires an API key. You can still paste YouTube URLs directly.
        </div>
      )}
    </div>
  );
};

export default YouTubeSearch;