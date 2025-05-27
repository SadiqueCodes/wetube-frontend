import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import './VideoCall.css';

function VideoCall({ socket, roomCode }) {
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState(null);
  const myVideo = useRef();
  const peersRef = useRef({});
  const negotiatingPeers = useRef(new Set());

  useEffect(() => {
    const init = async () => {
      try {
        console.log('Requesting media permissions...');
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log('Media access granted:', userStream.id);
        setStream(userStream);
        if (myVideo.current) {
          myVideo.current.srcObject = userStream;
          console.log('Local video stream set');
        }
        console.log('Joining video room:', roomCode);
        socket.emit('join-video', roomCode);
      } catch (err) {
        console.error('Media access error:', err);
        setError('Failed to access camera/microphone');
      }
    };

    init();

    return () => {
      console.log('Cleaning up VideoCall component...');
      if (stream) {
        console.log('Stopping local media tracks...');
        stream.getTracks().forEach((track) => {
          console.log('Stopping track:', track.kind);
          track.stop();
        });
      }
      if (myVideo.current) {
        myVideo.current.srcObject = null;
      }
      
      console.log('Destroying peer connections...');
      Object.entries(peersRef.current).forEach(([peerId, peer]) => {
        if (peer && !peer.destroyed) {
          console.log('Destroying peer connection:', peerId);
          peer.destroy();
        }
      });
      peersRef.current = {};
      setPeers({});
      negotiatingPeers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!socket || !stream) {
      console.log('Waiting for socket and stream...', { hasSocket: !!socket, hasStream: !!stream });
      return;
    }

    console.log('Setting up WebRTC event handlers...');

    const handleUserJoinedVideo = (userIds) => {
      console.log('Users joined video:', userIds);
      userIds.forEach((userId) => {
        if (!peersRef.current[userId]) {
          console.log('Creating new peer for user:', userId);
          const peer = createPeer(userId, socket.id, stream);
          peersRef.current[userId] = peer;
          setPeers((prev) => ({ ...prev, [userId]: peer }));
        } else {
          console.log('Peer already exists for user:', userId);
        }
      });
    };

    const handleUserSignal = ({ signal, from }) => {
      console.log('Received signal from:', from, 'Signal type:', signal.type);
      let peer = peersRef.current[from];

      if (signal.type === 'offer') {
        // Always create new peer for offers
        if (peer && !peer.destroyed) {
          console.log('Destroying existing peer to handle new offer');
          peer.destroy();
        }
        console.log('Creating new peer for offer from:', from);
        peer = addPeer(signal, from, stream);
        peersRef.current[from] = peer;
        setPeers((prev) => ({ ...prev, [from]: peer }));
      } 
      else if (signal.type === 'answer') {
        if (!peer || peer.destroyed) {
          console.log('Ignoring answer - no valid peer');
          return;
        }
        // Wait a bit to ensure the peer is ready for the answer
        setTimeout(() => {
          try {
            if (peer && !peer.destroyed) {
              console.log('Setting answer for peer:', from);
              peer.signal(signal);
            }
          } catch (err) {
            console.error('Error setting answer:', err);
            // If we get a state error, wait longer and try again
            if (err.message.includes('state')) {
              setTimeout(() => {
                try {
                  if (peer && !peer.destroyed) {
                    console.log('Retrying answer after delay for:', from);
                    peer.signal(signal);
                  }
                } catch (retryErr) {
                  console.error('Final error setting answer:', retryErr);
                  setError('Failed to establish connection. Please refresh.');
                }
              }, 1000);
            }
          }
        }, 500);
      }
      else if (signal.type === 'candidate') {
        if (peer && !peer.destroyed) {
          try {
            console.log('Adding ICE candidate for peer:', from);
            peer.signal(signal);
          } catch (err) {
            console.error('Error adding candidate:', err);
          }
        }
      }
    };

    const handleUserLeft = (userId) => {
      console.log('User left:', userId);
      if (peersRef.current[userId]) {
        console.log('Cleaning up peer connection for:', userId);
        peersRef.current[userId].destroy();
        delete peersRef.current[userId];
        negotiatingPeers.current.delete(userId);
        setPeers((prev) => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }
    };

    socket.on('user-joined-video', handleUserJoinedVideo);
    socket.on('user-signal', handleUserSignal);
    socket.on('user-left', handleUserLeft);

    return () => {
      console.log('Removing WebRTC event handlers...');
      socket.off('user-joined-video', handleUserJoinedVideo);
      socket.off('user-signal', handleUserSignal);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, stream]);

  function createPeer(userToSignal, callerId, stream) {
    console.log('Creating new initiator peer for:', userToSignal);
    const peer = new Peer({
      initiator: true,
      stream,
      sdpTransform: (sdp) => {
        // Ensure we're using unified plan
        if (!sdp.includes('unified-plan')) {
          sdp = sdp.replace('o=- ', 'o=- unified-plan ');
        }
        return sdp;
      },
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (!err.message.includes('state')) { // Ignore state errors
        setError(`Connection error. Please refresh.`);
      }
    });

    peer.on('signal', (signal) => {
      console.log('Local peer signaling:', signal.type);
      socket.emit('signal-user', {
        userToSignal,
        callerId,
        signal,
      });
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', userToSignal);
    });

    return peer;
  }

  function addPeer(signal, callerId, stream) {
    console.log('Adding new peer for:', callerId);
    const peer = new Peer({
      initiator: false,
      stream,
      sdpTransform: (sdp) => {
        // Ensure we're using unified plan
        if (!sdp.includes('unified-plan')) {
          sdp = sdp.replace('o=- ', 'o=- unified-plan ');
        }
        return sdp;
      },
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (!err.message.includes('state')) { // Ignore state errors
        setError(`Connection error. Please refresh.`);
      }
    });

    peer.on('signal', (signal) => {
      console.log('Local peer signaling:', signal.type);
      socket.emit('signal-user', {
        userToSignal: callerId,
        callerId: socket.id,
        signal,
      });
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', callerId);
    });

    // Process the offer
    try {
      console.log('Processing offer from peer:', callerId);
      peer.signal(signal);
    } catch (err) {
      console.error('Error processing offer:', err);
    }

    return peer;
  }

  const toggleCamera = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      track.enabled = !track.enabled;
      setIsCameraOn(track.enabled);
      console.log('Camera toggled:', track.enabled);
    }
  };

  const toggleMic = () => {
    if (stream) {
      const track = stream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMicOn(track.enabled);
      console.log('Microphone toggled:', track.enabled);
    }
  };

  if (error) {
    return (
      <div className="video-call-container">
        <div className="video-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container">
      <div className="video-grid">
        <div className="my-video-container">
          <video ref={myVideo} autoPlay muted playsInline />
          <div className="controls">
            <button onClick={toggleCamera}>{isCameraOn ? '🎥' : '🚫'}</button>
            <button onClick={toggleMic}>{isMicOn ? '🎤' : '🔇'}</button>
          </div>
        </div>
        {Object.entries(peers).map(([peerId, peer]) => (
          <PeerVideo key={peerId} peer={peer} peerId={peerId} />
        ))}
      </div>
    </div>
  );
}

const PeerVideo = ({ peer, peerId }) => {
  const ref = useRef();
  const streamRef = useRef();

  useEffect(() => {
    if (!peer) {
      console.log('No peer provided to PeerVideo');
      return;
    }

    console.log('Setting up peer video for:', peerId);

    const handleStream = (remoteStream) => {
      console.log('Received remote stream for peer:', peerId);
      if (ref.current && remoteStream !== streamRef.current) {
        ref.current.srcObject = remoteStream;
        streamRef.current = remoteStream;
        console.log('Remote video stream set for peer:', peerId);
      }
    };

    peer.on('stream', handleStream);

    return () => {
      console.log('Cleaning up peer video for:', peerId);
      peer.off('stream', handleStream);
      if (ref.current) {
        ref.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('Stopping remote track:', track.kind);
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [peer, peerId]);

  return (
    <div className="peer-video-container">
      <video ref={ref} autoPlay playsInline />
      <div className="video-loading">Connecting...</div>
    </div>
  );
};

export default VideoCall;
