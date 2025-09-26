import React, { useState } from 'react';
import { BookmarkNode, Bookmark } from '../types';
import { FolderIcon, BookmarkIcon } from './icons';

interface BookmarkTreeViewProps {
  nodes: BookmarkNode[];
  title: string;
  highlightedNodes?: Set<string>; // Set of IDs to highlight
  onSelect?: (node: BookmarkNode) => void;
  onDelete?: (nodeId: string) => void;
  onAddFolder?: (parentId: string | null) => void;
  onDrop?: (draggedId: string, targetId: string | null) => void;
  onAiClassify?: (folderId: string) => void;
  isClassifying?: boolean;
}

const Node: React.FC<{
  node: BookmarkNode;
  depth: number;
  highlightedNodes?: Set<string>;
  onSelect?: (node: BookmarkNode) => void;
  onDelete?: (nodeId: string) => void;
  onAddFolder?: (parentId: string | null) => void;
  onDrop?: (draggedId: string, targetId: string | null) => void;
  onAiClassify?: (folderId: string) => void;
  isClassifying?: boolean;
}> = ({
  node,
  depth,
  highlightedNodes,
  onSelect,
  onDelete,
  onAddFolder,
  onDrop,
  onAiClassify,
  isClassifying
}) => {
  const [isOpen, setIsOpen] = useState(depth < 2); // Auto-expand first few levels
  const isHighlighted = highlightedNodes?.has(node.id);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/bookmark-id', node.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('application/bookmark-id');
    if (draggedId && draggedId !== node.id && node.type === 'folder') {
      onDrop?.(draggedId, node.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (node.type === 'folder') {
    return (
      <div className={`ml-${depth * 2} my-1`}>
        <div
          className={`flex items-center p-1 rounded cursor-pointer ${isHighlighted ? 'bg-indigo-500/20' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <span className="w-4 mr-2">{isOpen ? '▼' : '▶'}</span>
          <FolderIcon className="w-5 h-5 mr-2 text-yellow-400" />
          <span className="text-sm font-medium text-slate-200 flex-1">{node.name}</span>
          <span className="ml-2 text-xs text-slate-500">({node.children.length})</span>

          {/* Action buttons */}
          <div className="ml-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(node);
              }}
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
              title="Edit folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddFolder?.(node.id);
              }}
              className="p-1 text-slate-400 hover:text-slate-200 rounded"
              title="Add subfolder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            {onAiClassify && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAiClassify(node.id);
                }}
                disabled={isClassifying}
                className="p-1 text-slate-400 hover:text-slate-200 rounded disabled:opacity-50"
                title="AI Classify Folder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this folder and all its contents?')) {
                  onDelete?.(node.id);
                }
              }}
              className="p-1 text-slate-400 hover:text-red-400 rounded"
              title="Delete folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        {isOpen && (
          <div>
            {node.children.map(child => (
              <Node
                key={child.id}
                node={child}
                depth={depth + 1}
                highlightedNodes={highlightedNodes}
                onSelect={onSelect}
                onDelete={onDelete}
                onAddFolder={onAddFolder}
                onDrop={onDrop}
                onAiClassify={onAiClassify}
                isClassifying={isClassifying}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`ml-${depth * 4} my-1 flex items-center p-1 rounded group ${isHighlighted ? 'bg-indigo-500/20' : ''}`}
      draggable
      onDragStart={handleDragStart}
    >
      <BookmarkIcon className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0" />
      <a
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-slate-300 hover:text-indigo-400 truncate flex-1"
        title={node.title}
      >
        {node.title}
      </a>

      {/* Action buttons */}
      <div className="ml-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(node);
          }}
          className="p-1 text-slate-400 hover:text-slate-200 rounded"
          title="Edit bookmark"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Are you sure you want to delete this bookmark?')) {
              onDelete?.(node.id);
            }
          }}
          className="p-1 text-slate-400 hover:text-red-400 rounded"
          title="Delete bookmark"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const BookmarkTreeView: React.FC<BookmarkTreeViewProps> = ({
  nodes,
  title,
  highlightedNodes,
  onSelect,
  onDelete,
  onAddFolder,
  onDrop,
  onAiClassify,
  isClassifying
}) => {
  return (
    <div className="bg-slate-800 p-4 rounded-lg w-full">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-bold text-white">{title}</h4>
        <button
          onClick={() => onAddFolder?.(null)}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md flex items-center"
          title="Add root folder"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Folder
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>No bookmarks found.</p>
            <p className="text-sm mt-2">Import bookmarks or add folders to get started.</p>
          </div>
        ) : (
          nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              depth={0}
              highlightedNodes={highlightedNodes}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddFolder={onAddFolder}
              onDrop={onDrop}
              onAiClassify={onAiClassify}
              isClassifying={isClassifying}
            />
          ))
        )}
      </div>
    </div>
  );
};
