import React, { useState } from 'react';
import { Bookmark, BookmarkFolder, BookmarkNode as BookmarkNodeType } from '../types';
import { FolderIcon, BookmarkIcon, EditIcon, DeleteIcon, AddFolderIcon, AiIcon } from './icons';

interface BookmarkNodeProps {
  node: BookmarkNodeType;
  onSelect: (node: BookmarkNodeType) => void;
  onDelete: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onDrop: (draggedId: string, targetId: string | null) => void;
  onAiClassify: (folderId: string) => void;
  isClassifying: boolean;
}

const BookmarkNode: React.FC<BookmarkNodeProps> = ({ node, onSelect, onDelete, onAddFolder, onDrop, onAiClassify, isClassifying }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/bookmark-id', node.id);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === 'folder') {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('application/bookmark-id');
    if (draggedId && draggedId !== node.id) {
        onDrop(draggedId, node.id);
    }
  };

  const isFolder = node.type === 'folder';

  return (
    <div className="ml-4">
      <div 
        draggable="true"
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center group p-1 rounded-md hover:bg-slate-700 cursor-pointer ${isDragOver ? 'bg-blue-500/50 outline-dashed outline-2 outline-blue-400' : ''}`}
        >
        <div className="flex items-center flex-grow" onClick={() => isFolder && setIsExpanded(!isExpanded)}>
          {isFolder ? <FolderIcon className="w-5 h-5 mr-2 text-yellow-500" /> : <BookmarkIcon className="w-5 h-5 mr-2 text-blue-400" />}
          <span className="truncate" title={isFolder ? node.name : node.title}>{isFolder ? node.name : node.title}</span>
          {isFolder && <span className="text-xs text-slate-500 ml-2">({node.children.length})</span>}
        </div>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {isFolder && process.env.API_KEY && (
              <button onClick={(e) => { e.stopPropagation(); onAiClassify(node.id); }} disabled={isClassifying} className="p-1 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed" title="AI Classify this folder">
                <AiIcon className="w-4 h-4 text-purple-400" />
              </button>
          )}
          {isFolder && (
            <button onClick={(e) => { e.stopPropagation(); onAddFolder(node.id); }} className="p-1 hover:bg-slate-600 rounded" title="Add new folder inside">
              <AddFolderIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onSelect(node); }} className="p-1 hover:bg-slate-600 rounded" title="Edit">
            <EditIcon className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1 hover:bg-slate-600 rounded" title="Delete">
            <DeleteIcon className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
      {isFolder && isExpanded && (
        <div className="border-l border-slate-700">
          {node.children.map(child => (
            <BookmarkNode key={child.id} node={child} onSelect={onSelect} onDelete={onDelete} onAddFolder={onAddFolder} onDrop={onDrop} onAiClassify={onAiClassify} isClassifying={isClassifying} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarkNode;