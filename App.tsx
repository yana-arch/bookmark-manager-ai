import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BookmarkNode, ViewMode, Bookmark, BookmarkFolder, AiConfig, AiConfigGroup } from './types';
import { parseBookmarksHTML, exportBookmarksToHTML } from './services/bookmarkParser';
import { BookmarkTreeView } from './components/BookmarkTreeView';
import EditBookmarkModal from './components/EditBookmarkModal';
import AiConfigModal from './components/modals/AiConfigModal';
import { AdvancedOrganizationModal } from './components/modals/AdvancedOrganizationModal';
import { useAiApi } from './hooks/useAiApi';
import { useAiConfig } from './context/AiConfigContext';
import { AiIcon, SpinnerIcon, SettingsIcon, SparklesIcon } from './components/icons';


const Notification: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onClose: () => void; }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeClasses = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white max-w-sm z-50 transition-transform transform-gpu animate-fade-in-down ${typeClasses[type]}`}>
      <div className="flex items-start">
        <div className="flex-grow pr-4">{message}</div>
        <button onClick={onClose} className="-mt-1 -mr-1 p-1 rounded-full hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>(() => {
    const saved = localStorage.getItem('bookmark-manager-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Tree);
  const [editingNode, setEditingNode] = useState<BookmarkNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationController, setClassificationController] = useState<AbortController | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showAiConfigModal, setShowAiConfigModal] = useState(false);
  const [showAdvancedOrgModal, setShowAdvancedOrgModal] = useState(false);
  const [editingAiConfig, setEditingAiConfig] = useState<AiConfig | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Use AI config context
    const {
      aiConfigs, activeAiConfigId, setActiveAiConfigId, addAiConfig, updateAiConfig, deleteAiConfig,
      aiConfigGroups, activeAiConfigGroupId, setActiveAiConfigGroupId, addAiConfigGroup, updateAiConfigGroup, deleteAiConfigGroup
    } = useAiConfig();
  
    // Use AI API hook
    const { getCategorySuggestion } = useAiApi();

    // Computed values
    const existingCategories = useMemo(() => {
      const categories = new Set<string>();
      const traverse = (nodes: BookmarkNode[]) => {
        for (const node of nodes) {
          if (node.type === 'bookmark') {
            node.tags?.forEach(tag => categories.add(tag));
          } else if (node.type === 'folder') {
            traverse(node.children);
          }
        }
      };
      traverse(bookmarks);
      return Array.from(categories);
    }, [bookmarks]);

    const filteredBookmarks = useMemo(() => {
      if (!searchTerm) return bookmarks;

      const searchLower = searchTerm.toLowerCase();
      const filterNodes = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.filter(node => {
          if (node.type === 'bookmark') {
            return node.title.toLowerCase().includes(searchLower) ||
                   node.url.toLowerCase().includes(searchLower) ||
                   node.tags?.some(tag => tag.toLowerCase().includes(searchLower));
          } else if (node.type === 'folder') {
            const filteredChildren = filterNodes(node.children);
            // Include folder if it has matching children or name matches
            return filteredChildren.length > 0 || node.name.toLowerCase().includes(searchLower);
          }
          return false;
        }).map(node => {
          if (node.type === 'folder') {
            return { ...node, children: filterNodes(node.children) };
          }
          return node;
        });
      };

      return filterNodes(bookmarks);
    }, [bookmarks, searchTerm]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
    };

    // File handling functions
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          try {
            const parsedBookmarks = parseBookmarksHTML(content);
            setBookmarks(parsedBookmarks);
            localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(parsedBookmarks));
            showNotification('Bookmarks imported successfully!', 'success');
          } catch (error) {
            console.error('Error parsing bookmarks:', error);
            showNotification('Error parsing bookmarks file. Please check the file format.', 'error');
          }
        };
        reader.readAsText(file);
      }
    };

    const handleImportClick = () => {
      fileInputRef.current?.click();
    };

    const handleExportClick = () => {
      try {
        const htmlContent = exportBookmarksToHTML(bookmarks);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Bookmarks exported successfully!', 'success');
      } catch (error) {
        console.error('Error exporting bookmarks:', error);
        showNotification('Error exporting bookmarks.', 'error');
      }
    };

    // Bookmark management functions
    const handleSave = (updatedNode: BookmarkNode) => {
      const updateNodeInTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map(node => {
          if (node.id === updatedNode.id) {
            return updatedNode;
          }
          if (node.type === 'folder') {
            return { ...node, children: updateNodeInTree(node.children) };
          }
          return node;
        });
      };

      const updatedBookmarks = updateNodeInTree(bookmarks);
      setBookmarks(updatedBookmarks);
      localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(updatedBookmarks));
      setEditingNode(null);
      showNotification('Bookmark updated successfully!', 'success');
    };

    const handleDelete = (nodeId: string) => {
      const deleteNodeFromTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.filter(node => {
          if (node.id === nodeId) {
            return false;
          }
          if (node.type === 'folder') {
            node.children = deleteNodeFromTree(node.children);
          }
          return true;
        });
      };

      const updatedBookmarks = deleteNodeFromTree(bookmarks);
      setBookmarks(updatedBookmarks);
      localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(updatedBookmarks));
      showNotification('Bookmark deleted successfully!', 'success');
    };

    const handleAddFolder = (parentId: string | null) => {
      const newFolder: BookmarkFolder = {
        id: crypto.randomUUID(),
        type: 'folder',
        name: 'New Folder',
        children: [],
        addDate: new Date().getTime().toString(),
      };

      if (parentId === null) {
        // Add to root
        setBookmarks(prev => [...prev, newFolder]);
      } else {
        // Add to specific parent folder
        const addToParent = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            if (node.id === parentId && node.type === 'folder') {
              return { ...node, children: [...node.children, newFolder] };
            }
            if (node.type === 'folder') {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        setBookmarks(prev => addToParent(prev));
      }

      setEditingNode(newFolder);
      showNotification('New folder created!', 'success');
    };

    const handleDrop = (draggedId: string, targetId: string | null) => {
      // Find the dragged node
      const findNode = (nodes: BookmarkNode[]): BookmarkNode | null => {
        for (const node of nodes) {
          if (node.id === draggedId) return node;
          if (node.type === 'folder') {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const draggedNode = findNode(bookmarks);
      if (!draggedNode) return;

      // Remove from current location
      const removeNode = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.filter(node => {
          if (node.id === draggedId) return false;
          if (node.type === 'folder') {
            node.children = removeNode(node.children);
          }
          return true;
        });
      };

      let newBookmarks = removeNode(bookmarks);

      // Add to new location
      if (targetId === null) {
        // Add to root
        newBookmarks = [...newBookmarks, draggedNode];
      } else {
        const addToTarget = (nodes: BookmarkNode[]): BookmarkNode[] => {
          return nodes.map(node => {
            if (node.id === targetId && node.type === 'folder') {
              return { ...node, children: [...node.children, draggedNode] };
            }
            if (node.type === 'folder') {
              return { ...node, children: addToTarget(node.children) };
            }
            return node;
          });
        };
        newBookmarks = addToTarget(newBookmarks);
      }

      setBookmarks(newBookmarks);
      localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(newBookmarks));
    };

    // AI classification functions
    const handleAiClassifyAll = async () => {
      if (!activeAiConfigId) {
        showNotification('Please select an AI configuration first.', 'error');
        return;
      }

      setIsClassifying(true);
      const controller = new AbortController();
      setClassificationController(controller);

      try {
        const classifyNode = async (node: BookmarkNode): Promise<BookmarkNode> => {
          if (controller.signal.aborted) return node;

          if (node.type === 'bookmark') {
            try {
              const category = await getCategorySuggestion(node, existingCategories);
              return { ...node, tags: [...(node.tags || []), category] };
            } catch (error) {
              console.error('Error classifying bookmark:', error);
              return node;
            }
          } else if (node.type === 'folder') {
            const classifiedChildren = await Promise.all(
              node.children.map(child => classifyNode(child))
            );
            return { ...node, children: classifiedChildren };
          }
          return node;
        };

        const classifiedBookmarks = await Promise.all(
          bookmarks.map(node => classifyNode(node))
        );

        if (!controller.signal.aborted) {
          setBookmarks(classifiedBookmarks);
          localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(classifiedBookmarks));
          showNotification('All bookmarks classified successfully!', 'success');
        }
      } catch (error) {
        console.error('Error during classification:', error);
        showNotification('Error during AI classification.', 'error');
      } finally {
        setIsClassifying(false);
        setClassificationController(null);
      }
    };

    const handleAiClassifyFolder = async (folderId: string) => {
      if (!activeAiConfigId) {
        showNotification('Please select an AI configuration first.', 'error');
        return;
      }

      const findFolder = (nodes: BookmarkNode[]): BookmarkFolder | null => {
        for (const node of nodes) {
          if (node.id === folderId && node.type === 'folder') return node;
          if (node.type === 'folder') {
            const found = findFolder(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const folder = findFolder(bookmarks);
      if (!folder) return;

      setIsClassifying(true);
      const controller = new AbortController();
      setClassificationController(controller);

      try {
        const classifyNode = async (node: BookmarkNode): Promise<BookmarkNode> => {
          if (controller.signal.aborted) return node;

          if (node.type === 'bookmark') {
            try {
              const category = await getCategorySuggestion(node, existingCategories);
              return { ...node, tags: [...(node.tags || []), category] };
            } catch (error) {
              console.error('Error classifying bookmark:', error);
              return node;
            }
          } else if (node.type === 'folder') {
            const classifiedChildren = await Promise.all(
              node.children.map(child => classifyNode(child))
            );
            return { ...node, children: classifiedChildren };
          }
          return node;
        };

        const classifiedChildren = await Promise.all(
          folder.children.map(child => classifyNode(child))
        );

        if (!controller.signal.aborted) {
          const updateFolderInTree = (nodes: BookmarkNode[]): BookmarkNode[] => {
            return nodes.map(node => {
              if (node.id === folderId && node.type === 'folder') {
                return { ...node, children: classifiedChildren };
              }
              if (node.type === 'folder') {
                return { ...node, children: updateFolderInTree(node.children) };
              }
              return node;
            });
          };

          const updatedBookmarks = updateFolderInTree(bookmarks);
          setBookmarks(updatedBookmarks);
          localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(updatedBookmarks));
          showNotification('Folder classified successfully!', 'success');
        }
      } catch (error) {
        console.error('Error during folder classification:', error);
        showNotification('Error during AI classification.', 'error');
      } finally {
        setIsClassifying(false);
        setClassificationController(null);
      }
    };
  
    // AI Config management functions
    const handleSaveAiConfig = (config: Omit<AiConfig, 'id' | 'createdAt'>) => {
      if (editingAiConfig) {
        updateAiConfig(editingAiConfig.id, config);
        showNotification('AI configuration updated successfully', 'success');
      } else {
        addAiConfig(config);
        showNotification('AI configuration added successfully', 'success');
      }
      setEditingAiConfig(null);
    };
  
    const handleDeleteAiConfig = (configId: string) => {
      if (window.confirm('Are you sure you want to delete this AI configuration?')) {
        deleteAiConfig(configId);
        showNotification('AI configuration deleted', 'info');
      }
    };
  
    const handleEditAiConfig = (config: AiConfig) => {
      setEditingAiConfig(config);
      setShowAiConfigModal(true);
    };
  
    const handleSetActiveAiConfig = (configId: string) => {
      setActiveAiConfigId(configId);
      showNotification('Active AI configuration set', 'success');
    };
  
    // AI Group management functions
    const handleSaveAiGroup = (group: Omit<AiConfigGroup, 'id' | 'createdAt'> | AiConfigGroup) => {
      if ('id' in group) {
        updateAiConfigGroup(group.id, group);
        showNotification('AI group updated successfully', 'success');
      } else {
        addAiConfigGroup(group);
        showNotification('AI group created successfully', 'success');
      }
    };
  
    const handleDeleteAiGroup = (groupId: string) => {
      if (window.confirm('Are you sure you want to delete this AI group?')) {
        deleteAiConfigGroup(groupId);
        showNotification('AI group deleted', 'info');
      }
    };
  
    const handleSetActiveAiGroup = (groupId: string) => {
      setActiveAiConfigGroupId(groupId);
      showNotification('Active AI group set', 'success');
    };
  return (
    <div className="bg-slate-900 text-slate-200 min-h-screen font-sans">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
      <div className="container mx-auto p-4">
        <header className="bg-slate-800 p-4 rounded-lg shadow-lg mb-4 sticky top-4 z-10">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <h1 className="text-3xl font-bold text-white mb-4 md:mb-0">Bookmark Manager AI</h1>
            <div className="flex items-center space-x-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".html" aria-label="Import bookmarks file" />
              <button onClick={handleImportClick} className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition" aria-label="Import bookmarks">Import</button>
              <button onClick={handleExportClick} className="px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 transition">Export</button>
              {aiConfigs.length > 0 && (
                <>
                  <button
                    onClick={handleAiClassifyAll}
                    disabled={isClassifying || bookmarks.length === 0 || !activeAiConfigId}
                    className="px-4 py-2 bg-purple-600 rounded-md hover:bg-purple-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClassifying ? (
                      <>
                        <SpinnerIcon className="w-5 h-5 mr-2 animate-spin" />
                        Classifying...
                      </>
                    ) : (
                      <>
                        <AiIcon className="w-5 h-5 mr-2" />
                        AI Classify All
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAdvancedOrgModal(true)}
                    disabled={bookmarks.length === 0 || !activeAiConfigId}
                    className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Advanced AI Organization"
                  >
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    Smart Organize
                  </button>
                  {isClassifying && classificationController && (
                    <button
                      onClick={() => {
                        classificationController.abort();
                        setClassificationController(null);
                        setIsClassifying(false);
                        showNotification("Classification cancelled.", 'info');
                      }}
                      className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 transition flex items-center"
                      title="Cancel classification"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => setShowAiConfigModal(true)}
                className="px-4 py-2 bg-slate-600 rounded-md hover:bg-slate-500 transition flex items-center"
                title="AI Configuration Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 bg-slate-700 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </header>

        <main className="bg-slate-800 p-4 rounded-lg shadow-lg">
          {bookmarks.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold">Welcome!</h2>
              <p className="text-slate-400 mt-2">Import your bookmarks.html file to get started.</p>
              <button onClick={handleImportClick} className="mt-4 px-6 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 transition font-semibold">Import Bookmarks</button>
            </div>
          ) : (
            <BookmarkTreeView
              nodes={filteredBookmarks}
              title="Your Bookmarks"
              onSelect={setEditingNode}
              onDelete={handleDelete}
              onAddFolder={handleAddFolder}
              onDrop={handleDrop}
              onAiClassify={handleAiClassifyFolder}
              isClassifying={isClassifying}
            />
          )}
        </main>
      </div>
      {editingNode && (
        <EditBookmarkModal
            node={editingNode}
            onClose={() => setEditingNode(null)}
            onSave={handleSave}
            existingCategories={existingCategories}
        />
      )}
      {showAiConfigModal && (
        <AiConfigModal
          isOpen={showAiConfigModal}
          onClose={() => {
            setShowAiConfigModal(false);
            setEditingAiConfig(null);
          }}
          // Config Props
          onSaveConfig={handleSaveAiConfig}
          onDeleteConfig={handleDeleteAiConfig}
          onSetConfigActive={handleSetActiveAiConfig}
          onEditConfig={setEditingAiConfig}
          editingConfig={editingAiConfig}
          existingConfigs={aiConfigs}
          activeConfigId={activeAiConfigId}
          // Group Props
          onSaveGroup={handleSaveAiGroup}
          onDeleteGroup={handleDeleteAiGroup}
          onSetGroupActive={handleSetActiveAiGroup}
          existingGroups={aiConfigGroups}
          activeGroupId={activeAiConfigGroupId}
        />
      )}
      {showAdvancedOrgModal && (
        <AdvancedOrganizationModal
          isOpen={showAdvancedOrgModal}
          onClose={() => setShowAdvancedOrgModal(false)}
          bookmarks={bookmarks}
          onApplyOrganization={setBookmarks}
        />
      )}
    </div>
  );
};

export default App;
