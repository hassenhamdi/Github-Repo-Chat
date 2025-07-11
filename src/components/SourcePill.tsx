import React from 'react';
import { ParsedFile } from '@/types';
import DocumentIcon from '@/components/icons/DocumentIcon';

interface SourcePillProps {
  source: ParsedFile;
}

const SourcePill: React.FC<SourcePillProps> = ({ source }) => {
  const title = source.path.split('/').pop() || source.path;

  return (
    <div
      title={source.path}
      className="inline-flex items-center bg-slate-700 hover:bg-slate-600/70 text-sky-300 text-xs font-medium px-2.5 py-1 rounded-full transition-colors cursor-default shadow"
    >
      <DocumentIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-sky-400" />
      <span className="truncate max-w-[180px] sm:max-w-[220px]">{title}</span>
    </div>
  );
};

export default SourcePill;