
import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator" aria-label="AI is typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
};

export default TypingIndicator;