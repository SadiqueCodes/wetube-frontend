import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Welcome.css";

function Welcome() {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      // Store the name in localStorage so we can use it later
      localStorage.setItem("userName", name.trim());
      navigate("/home");
    }
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1>Watch Together</h1>
        <p>Share moments with friends in real-time</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="What's your name?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit">Continue</button>
        </form>
      </div>
    </div>
  );
}

export default Welcome; 