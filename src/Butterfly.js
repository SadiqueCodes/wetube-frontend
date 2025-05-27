import React, { useState, useEffect } from "react";
import "./Butterfly.css";

const Butterfly = () => {
  const [position, setPosition] = useState({ top: "50%", left: "50%" });
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
  const [message, setMessage] = useState(null);
  const userName = localStorage.getItem("userName") || "Friend";

  useEffect(() => {
    const moveButterfly = () => {
      let newTop = Math.min(Math.max(parseFloat(position.top) + (Math.random() * 10 - 5), 15), 80);
      let newLeft = Math.min(Math.max(parseFloat(position.left) + (Math.random() * 15 - 7), 15), 85);

      if (newLeft > parseFloat(position.left)) setDirection(1);
      else setDirection(-1);

      setPosition({ top: `${newTop}%`, left: `${newLeft}%` });
    };

    const interval = setInterval(moveButterfly, 3000);
    return () => clearInterval(interval);
  }, [position]);

  const handleClick = () => {
    setMessage({
      text: `Hey ${userName} 🤍`,
      visible: true
    });

    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className="butterfly-container">
      <div className="butterfly-wrapper" style={{ top: position.top, left: position.left }}>
        <img
          src="/butterfly.gif"
          className="butterfly"
          style={{
            transform: `scaleX(${direction})`
          }}
          alt="butterfly"
          onClick={handleClick}
        />
      {message && (
          <div className="butterfly-message" style={{ 
            left: direction === 1 ? '100%' : 'auto',
            right: direction === -1 ? '100%' : 'auto',
            marginLeft: direction === 1 ? '10px' : '0',
            marginRight: direction === -1 ? '10px' : '0'
          }}>
          {message.text}
        </div>
      )}
      </div>
    </div>
  );
};

export default Butterfly;
