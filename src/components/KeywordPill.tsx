
import React from 'react';
import TagIcon from './icons/TagIcon';

interface KeywordPillProps {
  keyword: string;
}

const KeywordPill: React.FC<KeywordPillProps> = ({ keyword }) => {
  if (!keyword || keyword.trim() === '') {
    return null;
  }

  return (
    <div
      title={keyword}
      className="inline-flex items-center bg-teal-600/80 hover:bg-teal-500/80 text-teal-50 text-sm font-medium px-3 py-1.5 rounded-full transition-colors cursor-default shadow-md backdrop-blur-sm border border-teal-500/30"
    >
      <TagIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-teal-200" />
      <span className="truncate max-w-[150px] sm:max-w-[180px]">{keyword}</span>
    </div>
  );
};

export default KeywordPill;