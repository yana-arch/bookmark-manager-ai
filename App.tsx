import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BookmarkNode, ViewMode, Bookmark, BookmarkFolder, AiConfig } from './types';
import { parseBookmarksHTML, exportBookmarksToHTML } from './services/bookmarkParser';
import BookmarkNodeComponent from './components/BookmarkNode';
import EditBookmarkModal from './components/EditBookmarkModal';
import AiConfigModal from './components/modals/AiConfigModal';
import AdvancedOrganizationModal from './components/modals/AdvancedOrganizationModal';
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
  const { aiConfigs, activeAiConfigId, setActiveAiConfigId, getActiveConfig, addAiConfig, updateAiConfig, deleteAiConfig } = useAiConfig();

  // Use AI API hook
  const { getCategorySuggestion } = useAiApi();

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsedBookmarks = parseBookmarksHTML(content);
        setBookmarks(parsedBookmarks);
      };
      reader.readAsText(file);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportClick = () => {
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
  };
  
  const removeNode = (nodes: BookmarkNode[], id: string): BookmarkNode[] => {
      return nodes.filter(node => node.id !== id).map(node => {
          if (node.type === 'folder') {
              return {...node, children: removeNode(node.children, id)}
          }
          return node;
      })
  }


  const handleSave = (updatedNode: BookmarkNode) => {
    setBookmarks(prev => {
        const update = (nodes: BookmarkNode[]): BookmarkNode[] => {
            return nodes.map(node => {
                if (node.id === updatedNode.id) {
                    return updatedNode;
                }
                if (node.type === 'folder') {
                    return {...node, children: update(node.children)};
                }
                return node;
            });
        };
        return update(prev);
    });
    setEditingNode(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item and all its contents?')) {
      setBookmarks(prev => removeNode(prev, id));
    }
  };
  
  const handleAddFolder = (parentId: string | null) => {
      const newFolder: BookmarkNode = {
        id: crypto.randomUUID(),
        type: 'folder',
        name: 'New Folder',
        children: []
      };
      
      if(parentId === null){
           setBookmarks(prev => [...prev, newFolder]);
      } else {
           setBookmarks(prev => {
               const add = (nodes: BookmarkNode[]): BookmarkNode[] => {
                   return nodes.map(node => {
                       if(node.id === parentId && node.type === 'folder') {
                           return {...node, children: [...node.children, newFolder]};
                       }
                       if(node.type === 'folder') {
                           return {...node, children: add(node.children)};
                       }
                       return node;
                   })
               }
               return add(prev);
           })
      }
  }
  
  const handleDrop = (draggedId: string, targetId: string | null) => {
      let draggedNode: BookmarkNode | null = null;
      
      const findAndRemove = (nodes: BookmarkNode[], id: string): BookmarkNode[] => {
          return nodes.filter(node => {
              if (node.id === id) {
                  draggedNode = node;
                  return false;
              }
              if (node.type === 'folder') {
                  node.children = findAndRemove(node.children, id);
              }
              return true;
          });
      };
      
      const newBookmarks = findAndRemove(bookmarks, draggedId);
      
      if (!draggedNode) return;
      
      const add = (nodes: BookmarkNode[], tId: string | null, dNode: BookmarkNode): BookmarkNode[] => {
           if(tId === null) {
              return [...nodes, dNode];
          }
          return nodes.map(node => {
              if (node.id === tId && node.type === 'folder') {
                  return { ...node, children: [...node.children, dNode] };
              }
              if (node.type === 'folder') {
                  return { ...node, children: add(node.children, tId, dNode) };
              }
              return node;
          });
      };
      
      setBookmarks(add(newBookmarks, targetId, draggedNode));
  };


  const getCategories = useCallback((nodes: BookmarkNode[]): string[] => {
    let categories: string[] = [];
    for (const node of nodes) {
        if (node.type === 'folder') {
            categories.push(node.name);
            categories = categories.concat(getCategories(node.children));
        }
    }
    return [...new Set(categories)];
  }, []);

  const existingCategories = useMemo(() => getCategories(bookmarks), [bookmarks, getCategories]);

  // Generic function to process and apply suggestions with batching
  const runClassification = async (
    bookmarksToClassify: { bookmark: Bookmark; parentName: string | null }[]
  ) => {
    const controller = new AbortController();
    setClassificationController(controller);
    setIsClassifying(true);

    try {
      // Conservative batching for rate-limited APIs
      const BATCH_SIZE = 1; // Process 1 bookmark at a time to avoid rate limits
      const BATCH_DELAY = 2000; // 2 second delay between requests
      const RATE_LIMIT_DELAY = 65000; // 65 seconds for rate limit recovery
      const results: Array<{ bookmark: Bookmark; parentName: string | null; newCategory: string }> = [];
      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 3;

      // Process in batches to avoid rate limiting
      for (let i = 0; i < bookmarksToClassify.length; i += BATCH_SIZE) {
        // Check if cancelled
        if (controller.signal.aborted) {
          showNotification("Classification cancelled by user.", 'info');
          return;
        }

        const batch = bookmarksToClassify.slice(i, i + BATCH_SIZE);

        // Process current batch
        const batchPromises = batch.map(async ({ bookmark, parentName }) => {
          // Check if cancelled during batch processing
          if (controller.signal.aborted) {
            return { bookmark, parentName, newCategory: '' };
          }

          try {
            const category = await getCategorySuggestion(bookmark, existingCategories);
            consecutiveErrors = 0; // Reset error counter on success
            return {
              bookmark,
              parentName,
              newCategory: category.trim(),
            };
          } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to get category for bookmark "${bookmark.title}":`, error);

            // Check if this is a rate limit error
            if (error?.code === 'RATE_LIMIT' || errorMessage.includes('rate limit') || errorMessage.includes('429')) {
              consecutiveErrors++;
              showNotification(`Rate limit hit. Waiting longer before retry... (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, 'info');

              if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                throw new Error(`Rate limit exceeded ${MAX_CONSECUTIVE_ERRORS} times. Stopping classification. Try again later or use a different AI provider.`);
              }

              // Wait for rate limit recovery
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              // Retry this bookmark
              try {
                const category = await getCategorySuggestion(bookmark, existingCategories);
                consecutiveErrors = 0;
                return {
                  bookmark,
                  parentName,
                  newCategory: category.trim(),
                };
              } catch (retryError) {
                // If retry also fails, skip this bookmark
                return {
                  bookmark,
                  parentName,
                  newCategory: '',
                };
              }
            }

            // For other errors, skip this bookmark and continue
            return {
              bookmark,
              parentName,
              newCategory: '',
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        const successfulResults = batchResults
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<typeof batchPromises[0] extends Promise<infer U> ? U : never>).value);

        results.push(...successfulResults);

        // Update progress notification
        const processed = Math.min(i + BATCH_SIZE, bookmarksToClassify.length);
        showNotification(`Processing bookmarks... ${processed}/${bookmarksToClassify.length} completed`, 'info');

        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < bookmarksToClassify.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      const bookmarksToMove = results.filter(
        r => r.newCategory && r.newCategory !== r.parentName
      );

      if (bookmarksToMove.length === 0) {
        showNotification("AI analysis complete. All bookmarks are already well-organized!", 'info');
        return;
      }

      setBookmarks(prev => {
        // Use a deep copy to safely mutate and update state
        let nextState = JSON.parse(JSON.stringify(prev));
        const movedBookmarkIds = new Set(bookmarksToMove.map(b => b.bookmark.id));

        // 1. Removal Step: Recursively find and remove moved bookmarks from their original locations
        const removeRecursively = (nodes: BookmarkNode[]): BookmarkNode[] => {
          const filteredNodes = nodes.filter(node => !(node.type === 'bookmark' && movedBookmarkIds.has(node.id)));
          return filteredNodes.map(node => {
            if (node.type === 'folder') {
              return { ...node, children: removeRecursively(node.children) };
            }
            return node;
          });
        };
        nextState = removeRecursively(nextState);

        // 2. Addition Step: Group bookmarks by new category and add them to root folders
        const groups = new Map<string, Bookmark[]>();
        for (const { bookmark, newCategory } of bookmarksToMove) {
          if (!groups.has(newCategory)) groups.set(newCategory, []);
          groups.get(newCategory)!.push(bookmark);
        }

        for (const [categoryName, bookmarksInGroup] of groups.entries()) {
          const existingFolder = nextState.find(
            (n): n is BookmarkFolder => n.type === 'folder' && n.name === categoryName
          );

          if (existingFolder) {
            existingFolder.children.push(...bookmarksInGroup);
          } else {
            nextState.push({
              id: crypto.randomUUID(),
              type: 'folder',
              name: categoryName,
              children: bookmarksInGroup,
              addDate: new Date().getTime().toString(),
            });
          }
        }
        
        return nextState;
      });
      showNotification(`Successfully reorganized ${bookmarksToMove.length} bookmarks.`, 'success');
    } catch (error) {
      console.error("AI Classification failed:", error);
      showNotification("An error occurred during AI classification.", 'error');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleAiClassifyAll = async () => {
    const getAllBookmarksWithParent = (
      nodes: BookmarkNode[],
      parentName: string | null
    ): { bookmark: Bookmark; parentName: string | null }[] => {
      let allBookmarks: { bookmark: Bookmark; parentName: string | null }[] = [];
      for (const node of nodes) {
        if (node.type === 'bookmark') {
          allBookmarks.push({ bookmark: node, parentName });
        } else {
          allBookmarks = allBookmarks.concat(getAllBookmarksWithParent(node.children, node.name));
        }
      }
      return allBookmarks;
    };

    const allBookmarksToClassify = getAllBookmarksWithParent(bookmarks, null);

    if (allBookmarksToClassify.length === 0) {
      showNotification("No bookmarks found to classify.", 'info');
      return;
    }

    if (!window.confirm(`This will analyze all ${allBookmarksToClassify.length} bookmarks and move them to AI-suggested folders. This is a non-destructive tidy-up. Continue?`)) {
      showNotification("Classification cancelled.", 'info');
      return;
    }
    
    await runClassification(allBookmarksToClassify);
  };
  
  const handleAiClassifyFolder = async (folderId: string) => {
    let folderToClassify: BookmarkFolder | null = null;
    
    const findFolder = (nodes: BookmarkNode[]): BookmarkFolder | null => {
      for(const node of nodes) {
        if(node.id === folderId && node.type === 'folder') return node;
        if(node.type === 'folder') {
          const found = findFolder(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    folderToClassify = findFolder(bookmarks);

    if (!folderToClassify) {
      console.error("Could not find folder with ID:", folderId);
      showNotification("Error: Could not find the specified folder.", 'error');
      return;
    }
    
    const bookmarksToClassify = folderToClassify.children
        .filter((node): node is Bookmark => node.type === 'bookmark')
        .map(bookmark => ({ bookmark, parentName: folderToClassify!.name }));

    if (bookmarksToClassify.length === 0) {
      showNotification("This folder contains no bookmarks to classify.", 'info');
      return;
    }
    
     if (!window.confirm(`This will analyze the ${bookmarksToClassify.length} bookmarks in "${folderToClassify.name}" and move any that don't match into other folders. Continue?`)) {
      showNotification("Classification cancelled.", 'info');
      return;
    }

    await runClassification(bookmarksToClassify);
  }

  const filterNodes = (nodes: BookmarkNode[], term: string): BookmarkNode[] => {
    if (!term) return nodes;
    const lowerCaseTerm = term.toLowerCase();

    return nodes.reduce((acc, node) => {
        if (node.type === 'folder') {
            const filteredChildren = filterNodes(node.children, term);
            if (node.name.toLowerCase().includes(lowerCaseTerm) || filteredChildren.length > 0) {
                acc.push({ ...node, children: filteredChildren });
            }
        } else {
            if (node.title.toLowerCase().includes(lowerCaseTerm) || 
                node.url.toLowerCase().includes(lowerCaseTerm) ||
                node.tags?.some(tag => tag.toLowerCase().includes(lowerCaseTerm))) {
                acc.push(node);
            }
        }
        return acc;
    }, [] as BookmarkNode[]);
  };

  const filteredBookmarks = useMemo(() => filterNodes(bookmarks, searchTerm), [bookmarks, searchTerm]);

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('bookmark-manager-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // AI Config management functions
  const handleSaveAiConfig = (config: Omit<AiConfig, 'id' | 'createdAt'>) => {
    if (editingAiConfig) {
      updateAiConfig(editingAiConfig.id, config);
    } else {
      addAiConfig(config);
    }
  };

  const handleDeleteAiConfig = (configId: string) => {
    if (window.confirm('Are you sure you want to delete this AI configuration?')) {
      deleteAiConfig(configId);
    }
  };

  const handleEditAiConfig = (config: AiConfig) => {
    setEditingAiConfig(config);
    setShowAiConfigModal(true);
  };

  const handleSetActiveAiConfig = (configId: string) => {
    setActiveAiConfigId(configId);
    showNotification('AI configuration updated successfully', 'success');
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
            <div onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData('application/bookmark-id');
              if(draggedId) {
                handleDrop(draggedId, null);
              }
            }} onDragOver={(e) => e.preventDefault()}>
              <button onClick={() => handleAddFolder(null)} className="mb-4 flex items-center px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
                Add Root Folder
              </button>
              {filteredBookmarks.map(node => (
                <BookmarkNodeComponent 
                    key={node.id} 
                    node={node} 
                    onSelect={setEditingNode} 
                    onDelete={handleDelete}
                    onAddFolder={handleAddFolder}
                    onDrop={handleDrop}
                    onAiClassify={handleAiClassifyFolder}
                    isClassifying={isClassifying}
                />
              ))}
            </div>
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
          onSave={handleSaveAiConfig}
          onDelete={handleDeleteAiConfig}
          onSetActive={handleSetActiveAiConfig}
          onEdit={setEditingAiConfig}
          editingConfig={editingAiConfig}
          existingConfigs={aiConfigs}
          activeConfigId={activeAiConfigId}
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
