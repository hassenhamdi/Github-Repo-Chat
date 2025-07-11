
import React from 'react';

interface UnifiedAILoadingAnimationProps {
  currentPhaseText: string;
  detailText?: string;
  isCompact?: boolean;
}

const UnifiedAILoadingAnimation: React.FC<UnifiedAILoadingAnimationProps> = ({ 
  currentPhaseText, 
  detailText,
  isCompact = false 
}) => {
  const containerClasses = isCompact 
    ? "unified-ai-animation-container compact" 
    : "unified-ai-animation-container";
  const coreClasses = isCompact ? "ai-core compact" : "ai-core";
  const phaseTextClasses = isCompact ? "unified-ai-phase-text compact" : "unified-ai-phase-text";
  const detailTextClasses = isCompact ? "unified-ai-detail-text compact" : "unified-ai-detail-text";

  return (
    <div className={containerClasses}>
      <div className={coreClasses}>
        {/* The ::before and ::after pseudo-elements will create the radiating rings via CSS */}
      </div>
      <p className={phaseTextClasses}>{currentPhaseText}</p>
      {detailText && <p className={detailTextClasses}>{detailText}</p>}
    </div>
  );
};

export default UnifiedAILoadingAnimation;
