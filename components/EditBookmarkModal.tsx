
import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkFolder, BookmarkNode } from '../types';
import { getCategorySuggestion } from '../services/geminiService';
import { AiIcon, SpinnerIcon } from './icons';

interface EditBookmarkModalProps {
  node: BookmarkNode | null;
  onClose: () => void;
  onSave: (node: BookmarkNode) => void;
  existingCategories: string[];
}

// FIX: Define a compatible form state type that can hold properties from both Bookmark and BookmarkFolder.
// The original `Partial<Bookmark & BookmarkFolder>` resulted in an impossible type
// because the `type` property would be `'bookmark' & 'folder'`, which is `never`.
type ModalFormData = Partial<Omit<Bookmark, 'type'> & Omit<BookmarkFolder, 'type'>> & {
  type?: 'bookmark' | 'folder';
};

const EditBookmarkModal: React.FC<EditBookmarkModalProps> = ({ node, onClose, onSave, existingCategories }) => {
  const [formData, setFormData] = useState<ModalFormData>({});
  const [isManualSuggesting, setIsManualSuggesting] = useState(false);
  const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const autoSuggestTags = useCallback(async (bookmarkNode: Bookmark) => {
    if (!process.env.API_KEY) return;
    setIsAutoSuggesting(true);
    try {
        const category = await getCategorySuggestion(bookmarkNode, existingCategories);
        if (category) {
            setFormData(prev => ({
                ...prev,
                tags: [...(prev.tags || []), category].filter((v, i, a) => a.indexOf(v) === i)
            }));
        }
    } catch (error) {
        console.error("Auto-suggestion for tags failed:", error);
        // Fail silently on auto-suggestion to not annoy user
    } finally {
        setIsAutoSuggesting(false);
    }
  }, [existingCategories]);

  useEffect(() => {
    if (node) {
      setFormData(node);
      setSuggestion(null);
      if (node.type === 'bookmark' && (!node.tags || node.tags.length === 0)) {
          autoSuggestTags(node);
      }
    }
  }, [node, autoSuggestTags]);

  if (!node) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'tags') {
        setFormData(prev => ({ ...prev, [name]: value.split(',').map(tag => tag.trim()) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as BookmarkNode);
  };

  const handleGetSuggestion = async () => {
      if(node.type !== 'bookmark') return;
      setIsManualSuggesting(true);
      setSuggestion(null);
      try {
          const result = await getCategorySuggestion(node, existingCategories);
          setSuggestion(result);
      } catch (error) {
          alert((error as Error).message);
      } finally {
          setIsManualSuggesting(false);
      }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-slate-800 text-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Edit {node.type === 'folder' ? 'Folder' : 'Bookmark'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {node.type === 'folder' ? (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">Folder Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-slate-300">Title</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-slate-300">URL</label>
                  <input
                    type="text"
                    id="url"
                    name="url"
                    value={formData.url || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="tags" className="flex items-center text-sm font-medium text-slate-300">
                    <span>Tags (comma-separated)</span>
                    {isAutoSuggesting && <SpinnerIcon className="w-4 h-4 ml-2" />}
                  </label>
                  <input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags?.join(', ') || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {process.env.API_KEY && (
                    <div>
                        <button type="button" onClick={handleGetSuggestion} disabled={isManualSuggesting || isAutoSuggesting} className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50">
                           <AiIcon className="w-5 h-5 mr-2" />
                            {isManualSuggesting ? 'Thinking...' : 'AI Suggestion for new folder'}
                        </button>
                        {suggestion && <p className="mt-2 text-sm text-green-400">Suggestion: Create and move to a folder named "{suggestion}"</p>}
                    </div>
                )}
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookmarkModal;
