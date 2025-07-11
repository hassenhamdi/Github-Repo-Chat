
import React from 'react';

interface GlobalProgressIndicatorProps {
  progressPercent?: number; // 0-100 for determinate progress
  isPulsing?: boolean; // For indeterminate progress, a pulsing/breathing effect on the bar
}

const GlobalProgressIndicator: React.FC<GlobalProgressIndicatorProps> = ({
  progressPercent,
  isPulsing = false,
}) => {
  const showProgressBar = progressPercent !== undefined || isPulsing;

  return (
    <>
      {showProgressBar && (
        <div className="progress-bar-container mt-3 mb-1"> {/* Adjusted margin */}
          <div
            className={`progress-bar-fill ${isPulsing && progressPercent === undefined ? 'animate-pulse' : ''}`}
            style={{ width: progressPercent !== undefined ? `${progressPercent}%` : (isPulsing ? '100%' : '0%') }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Current task progress" // More generic label
          ></div>
        </div>
      )}
    </>
  );
};

export default GlobalProgressIndicator;
