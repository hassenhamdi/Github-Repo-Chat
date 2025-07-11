
import React from 'react';

interface BotIconProps {
  className?: string;
}

const BotIcon: React.FC<BotIconProps> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className || "w-6 h-6"}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    <circle cx="8.5" cy="11.5" r="1.5"/>
    <circle cx="15.5" cy="11.5" r="1.5"/>
    <path d="M8 16h8c.55 0 1-.45 1-1s-.45-1-1-1H8c-.55 0-1 .45-1 1s.45 1 1 1z"/>
  </svg>
);

export default BotIcon;