import { AiConfig, AiConfigGroup, Bookmark, BookmarkNode, BookmarkFolder, ProcessingLog, OrganizationPlan, OrganizationSuggestion, OrganizationConflict, DuplicateGroup } from '../../types';
import { getGenerativeModel } from './modelFactory';
import { buildBatchOrganizePrompt } from '../../lib/promptBuilder';

// Re-export types for convenience
export type { ProcessingLog, OrganizationPlan, OrganizationSuggestion, OrganizationConflict, DuplicateGroup };

export class BookmarkOrganizer {
  private aiConfigs: AiConfig[];
  private aiConfigGroups: AiConfigGroup[];
  private abortController: AbortController | null = null;
  private logs: ProcessingLog[] = [];
  private onProgress?: (progress: { processed: number; total: number; logs: ProcessingLog[] }) => void;

  constructor(
    aiConfigs: AiConfig[],
    aiConfigGroups: AiConfigGroup[],
    options: {
      onProgress?: (progress: { processed: number; total: number; logs: ProcessingLog[] }) => void;
    } = {}
  ) {
    this.aiConfigs = aiConfigs;
    this.aiConfigGroups = aiConfigGroups;
    this.onProgress = options.onProgress;
  }

  startOperation(): AbortController {
    this.abortController = new AbortController();
    this.logs = [];
    this.addLog('info', 'Starting bookmark organization process');
    return this.abortController;
  }

  cancelOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.addLog('warning', 'Operation cancelled by user');
    }
  }

  addLog(level: 'info' | 'warning' | 'error' | 'success', message: string, metadata?: Record<string, any>): void {
    const log: ProcessingLog = {
      id: crypto.randomUUID(),
      level,
      message,
      timestamp: new Date(),
      metadata
    };
    this.logs.push(log);
  }

  getLogs(): ProcessingLog[] {
    return [...this.logs];
  }

  async organizeBookmarks(
    bookmarks: BookmarkNode[],
    options: {
      groupId: string;
      maxDepth?: number;
      createHierarchy?: boolean;
      detectDuplicates?: boolean;
      generateTags?: boolean;
      confidenceThreshold?: number;
      batchSize?: number;
    }
  ): Promise<OrganizationPlan> {
    const {
      groupId,
      maxDepth = 3,
      createHierarchy = true,
      detectDuplicates = true,
      generateTags = true,
      confidenceThreshold = 0.5,
      batchSize = 10
    } = options;

    this.addLog('info', `Starting organization with options: maxDepth=${maxDepth}, createHierarchy=${createHierarchy}, detectDuplicates=${detectDuplicates}, generateTags=${generateTags}, confidenceThreshold=${confidenceThreshold}, batchSize=${batchSize}`);

    // Extract all bookmarks from the tree
    const allBookmarks = this.extractBookmarks(bookmarks);
    this.addLog('info', `Extracted ${allBookmarks.length} bookmarks from the tree`);

    // Detect duplicates if requested
    let duplicates: DuplicateGroup[] = [];
    if (detectDuplicates) {
      duplicates = this.detectDuplicates(allBookmarks);
      this.addLog('info', `Detected ${duplicates.length} duplicate groups`);
    }

    // Get organization suggestions
    const suggestions = await this.organizeBookmarksInParallel(
      allBookmarks,
      bookmarks,
      {
        groupId,
        batchSize,
        maxDepth,
        createHierarchy,
        generateTags,
        confidenceThreshold
      }
    );

    // Identify conflicts
    const conflicts = this.identifyConflicts(suggestions, bookmarks);
    this.addLog('info', `Identified ${conflicts.length} conflicts`);

    // Generate new folder structure
    const newFolders = this.generateFolderStructure(suggestions, createHierarchy);
    this.addLog('info', `Generated ${newFolders.length} new folders`);

    const plan: OrganizationPlan = {
      suggestions,
      conflicts,
      duplicates,
      newFolders,
      metadata: {
        totalBookmarks: allBookmarks.length,
        processedBookmarks: suggestions.length,
        createdAt: new Date(),
        aiConfigsUsed: [groupId] // This should be the actual config IDs used
      }
    };

    this.addLog('success', 'Organization plan created successfully');
    return plan;
  }

  private async organizeBookmarksInParallel(
    bookmarksToProcess: Bookmark[],
    originalTree: BookmarkNode[],
    options: {
      groupId: string;
      batchSize: number;
      maxDepth: number;
      createHierarchy: boolean;
      generateTags: boolean;
      confidenceThreshold: number;
    }
  ): Promise<OrganizationSuggestion[]> {
    const { groupId, batchSize, maxDepth, createHierarchy, generateTags, confidenceThreshold } = options;
    
    const group = this.aiConfigGroups.find(g => g.id === groupId);
    if (!group || group.aiConfigIds.length === 0) {
      this.addLog('error', `AI Group "${group?.name || groupId}" not found or is empty.`);
      throw new Error('Invalid AI Group selected.');
    }

    const allSuggestions: OrganizationSuggestion[] = [];
    const existingFolderStructure = JSON.stringify(this.getFolderStructure(originalTree), null, 2);

    const batches: Bookmark[][] = [];
    for (let i = 0; i < bookmarksToProcess.length; i += batchSize) {
      batches.push(bookmarksToProcess.slice(i, i + batchSize));
    }

    this.addLog('info', `Split ${bookmarksToProcess.length} bookmarks into ${batches.length} batches for group "${group.name}".`);
    let processedCount = 0;
    this.onProgress?.({ processed: 0, total: batches.length, logs: this.logs });

    const batchPromises = batches.map((batch, index) => async () => {
      if (this.abortController?.signal.aborted) {
        this.addLog('warning', `Batch ${index + 1} skipped due to cancellation.`);
        return;
      }

      // Round-robin load balancing
      const configId = group.aiConfigIds[index % group.aiConfigIds.length];
      const model = getGenerativeModel(this.aiConfigs, configId);
      const config = this.aiConfigs.find(c => c.id === configId);

      this.addLog('info', `Processing batch ${index + 1}/${batches.length} with "${config?.name || configId}"...`);
      const prompt = buildBatchOrganizePrompt(batch, existingFolderStructure, maxDepth, createHierarchy, generateTags);

      try {
        const response = await model.generateContent(prompt, { signal: this.abortController?.signal });
        const batchSuggestions = this.parseBatchAISuggestions(response.text, batch);
        const validSuggestions = batchSuggestions.filter(s => s.confidence >= confidenceThreshold);
        allSuggestions.push(...validSuggestions);
        this.addLog('success', `Batch ${index + 1} (via ${config?.name}) processed successfully.`);
      } catch (error: any) {
        const errorMessage = error.name === 'AbortError' ? 'Batch cancelled' : (error.message || 'Unknown error');
        this.addLog('error', `Error in batch ${index + 1} with "${config?.name}": ${errorMessage}`, {
          provider: config?.provider,
          statusCode: error?.status || error?.code,
        });
      } finally {
        processedCount++;
        this.onProgress?.({ processed: processedCount, total: batches.length, logs: this.logs });
      }
    });

    await Promise.allSettled(batchPromises.map(p => p()));

    this.addLog('success', `Parallel processing complete. Total suggestions: ${allSuggestions.length}`);
    return allSuggestions;
  }

  // ... (rest of the file remains the same) ...

  private parseBatchAISuggestions(response: string, bookmarks: Bookmark[]): OrganizationSuggestion[] {
    try {
      // The AI might wrap the JSON in ```json ... ```, so we need to extract it.
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;
      const parsed = JSON.parse(jsonString.trim());

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not a JSON array.');
      }

      return parsed.map((item: any): OrganizationSuggestion => {
        const bookmark = bookmarks.find(b => b.id === item.bookmarkId);
        if (!bookmark) {
          this.addLog('warning', `AI returned a suggestion for an unknown bookmarkId: ${item.bookmarkId}`);
          return null;
        }
        return {
          bookmarkId: item.bookmarkId,
          suggestedCategory: item.category || 'Uncategorized',
          confidence: Math.max(0, Math.min(1, item.confidence || 0)),
          reasoning: item.reasoning || 'Batch AI-generated suggestion',
          suggestedTags: Array.isArray(item.tags) ? item.tags : [],
        };
      }).filter((s): s is OrganizationSuggestion => s !== null);

    } catch (error: any) {
      this.addLog('error', `Failed to parse batch AI response: ${error.message}`);
      return [];
    }
  }

  private getFolderStructure(nodes: BookmarkNode[]): any {
    const structure: any = {};
    for (const node of nodes) {
      if (node.type === 'folder') {
        structure[node.name] = this.getFolderStructure(node.children);
      }
    }
    return structure;
  }

  private extractBookmarks(nodes: BookmarkNode[]): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    const traverse = (nodes: BookmarkNode[], currentPath: string[] = []) => {
      for (const node of nodes) {
        if (node.type === 'bookmark') {
          bookmarks.push({
            ...node,
            currentPath: currentPath.join(' > '),
          } as Bookmark & { currentPath: string });
        } else if (node.type === 'folder') {
          traverse(node.children, [...currentPath, node.name]);
        }
      }
    };
    traverse(nodes);
    return bookmarks;
  }

  private detectDuplicates(bookmarks: Bookmark[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];

    // Detect exact URL duplicates
    const urlMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;
      const url = bookmark.url.toLowerCase().trim();
      if (!urlMap.has(url)) {
        urlMap.set(url, []);
      }
      urlMap.get(url)!.push(bookmark);
    }

    for (const [, bookmarkGroup] of urlMap) {
      if (bookmarkGroup.length > 1) {
        const primary = this.selectPrimaryBookmark(bookmarkGroup);
        const duplicates = bookmarkGroup.filter(b => b.id !== primary.id);
        groups.push({
          primaryBookmark: primary,
          duplicates,
          mergeStrategy: 'keep_primary',
        });
      }
    }

    // Detect same domain duplicates - group by domain and keep shortest URL
    const domainMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;
      try {
        const url = new URL(bookmark.url);
        const domain = url.hostname.toLowerCase();
        if (!domainMap.has(domain)) {
          domainMap.set(domain, []);
        }
        domainMap.get(domain)!.push(bookmark);
      } catch (error) {
        // Invalid URL, skip
        continue;
      }
    }

    for (const [domain, bookmarkGroup] of domainMap) {
      if (bookmarkGroup.length > 1) {
        // Sort by URL length (shortest first) and then by title quality
        const sortedBookmarks = bookmarkGroup.sort((a, b) => {
          // First priority: shorter URL
          const urlLengthA = a.url?.length || 0;
          const urlLengthB = b.url?.length || 0;
          if (urlLengthA !== urlLengthB) {
            return urlLengthA - urlLengthB;
          }

          // Second priority: title length (longer title is better)
          const titleLengthA = a.title?.length || 0;
          const titleLengthB = b.title?.length || 0;
          if (titleLengthA !== titleLengthB) {
            return titleLengthB - titleLengthA;
          }

          // Third priority: has tags
          const tagsA = a.tags?.length || 0;
          const tagsB = b.tags?.length || 0;
          return tagsB - tagsA;
        });

        const primary = sortedBookmarks[0];
        const duplicates = sortedBookmarks.slice(1);

        // Only create group if we have actual duplicates
        if (duplicates.length > 0) {
          groups.push({
            primaryBookmark: primary,
            duplicates,
            mergeStrategy: 'keep_primary',
          });

          this.addLog('info', `Found ${duplicates.length + 1} bookmarks for domain "${domain}", keeping: "${primary.title || primary.url}"`);
        }
      }
    }

    return groups;
  }
  
  private selectPrimaryBookmark(bookmarks: Bookmark[]): Bookmark {
    return bookmarks.reduce((primary, current) => {
      const primaryScore = (primary.title?.length || 0) + (primary.tags?.length || 0);
      const currentScore = (current.title?.length || 0) + (current.tags?.length || 0);
      return currentScore > primaryScore ? current : primary;
    });
  }

  private identifyConflicts(
    suggestions: OrganizationSuggestion[],
    currentBookmarks: BookmarkNode[]
  ): OrganizationConflict[] {
    const conflicts: OrganizationConflict[] = [];
    const currentLocations = new Map<string, string>();
    const buildLocationMap = (nodes: BookmarkNode[], path: string[] = []) => {
      for (const node of nodes) {
        if (node.type === 'bookmark') {
          currentLocations.set(node.id, path.join(' > ') || 'Root');
        } else if (node.type === 'folder') {
          buildLocationMap(node.children, [...path, node.name]);
        }
      }
    };
    buildLocationMap(currentBookmarks);

    for (const suggestion of suggestions) {
      const currentLocation = currentLocations.get(suggestion.bookmarkId) || 'Root';
      if (currentLocation !== suggestion.suggestedCategory) {
        conflicts.push({
          bookmarkId: suggestion.bookmarkId,
          currentCategory: currentLocation,
          suggestedCategory: suggestion.suggestedCategory,
          confidence: suggestion.confidence,
        });
      }
    }
    return conflicts;
  }

  private generateFolderStructure(
    suggestions: OrganizationSuggestion[],
    createHierarchy: boolean
  ): string[] {
    const folders = new Set<string>();
    for (const suggestion of suggestions) {
      if (createHierarchy) {
        const parts = suggestion.suggestedCategory.split(' > ');
        let currentPath = '';
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath} > ${part}` : part;
          folders.add(currentPath);
        }
      } else {
        folders.add(suggestion.suggestedCategory);
      }
    }
    return Array.from(folders).sort();
  }
}

/**
 * Apply organization plan to bookmark tree
 */
export function applyOrganizationPlan(
  currentBookmarks: BookmarkNode[],
  plan: OrganizationPlan,
  options: {
    resolveConflicts?: 'auto' | 'manual';
    handleDuplicates?: 'merge' | 'keep_all';
  } = {}
): BookmarkNode[] {
  const { resolveConflicts = 'auto', handleDuplicates = 'merge' } = options;

  // Create a deep copy
  let newBookmarks = JSON.parse(JSON.stringify(currentBookmarks));

  // Handle duplicates first
  if (handleDuplicates === 'merge') {
    newBookmarks = applyDuplicateMerging(newBookmarks, plan.duplicates);
  }

  // Apply suggestions
  newBookmarks = applySuggestions(newBookmarks, plan.suggestions, resolveConflicts);

  // Create new folder structure
  newBookmarks = createFolderStructure(newBookmarks, plan.newFolders);

  return newBookmarks;
}

/**
 * Apply duplicate merging
 */
function applyDuplicateMerging(
  bookmarks: BookmarkNode[],
  duplicates: DuplicateGroup[]
): BookmarkNode[] {
  // Remove duplicate bookmarks
  const duplicateIds = new Set(
    duplicates.flatMap(group => group.duplicates.map(d => d.id))
  );

  const removeDuplicates = (nodes: BookmarkNode[]): BookmarkNode[] => {
    return nodes
      .filter(node => !(node.type === 'bookmark' && duplicateIds.has(node.id)))
      .map(node => {
        if (node.type === 'folder') {
          return { ...node, children: removeDuplicates(node.children) };
        }
        return node;
      });
  };

  return removeDuplicates(bookmarks);
}

/**
 * Apply organization suggestions
 */
function applySuggestions(
  bookmarks: BookmarkNode[],
  suggestions: OrganizationSuggestion[],
  resolveConflicts: 'auto' | 'manual'
): BookmarkNode[] {
  const suggestionMap = new Map(
    suggestions.map(s => [s.bookmarkId, s])
  );

  // For now, implement auto-resolution
  // TODO: Add manual conflict resolution UI
  const moveBookmarks: Array<{ bookmark: Bookmark; targetPath: string[] }> = [];

  const collectMoves = (nodes: BookmarkNode[], currentPath: string[] = []) => {
    for (const node of nodes) {
      if (node.type === 'bookmark') {
        const suggestion = suggestionMap.get(node.id);
        if (suggestion) {
          const targetPath = suggestion.suggestedCategory.split(' > ');
          if (targetPath.join(' > ') !== currentPath.join(' > ')) {
            moveBookmarks.push({ bookmark: node, targetPath });
          }
        }
      } else if (node.type === 'folder') {
        collectMoves(node.children, [...currentPath, node.name]);
      }
    }
  };

  collectMoves(bookmarks);

  // Remove bookmarks from current locations
  let result = bookmarks;
  for (const move of moveBookmarks) {
    result = removeBookmarkById(result, move.bookmark.id);
  }

  // Add bookmarks to new locations
  for (const move of moveBookmarks) {
    result = addBookmarkToPath(result, move.bookmark, move.targetPath);
  }

  return result;
}

/**
 * Create folder structure
 */
function createFolderStructure(
  bookmarks: BookmarkNode[],
  newFolders: string[]
): BookmarkNode[] {
  let result = [...bookmarks];

  for (const folderPath of newFolders) {
    const pathParts = folderPath.split(' > ');
    result = ensureFolderPath(result, pathParts);
  }

  return result;
}

/**
 * Utility functions for bookmark tree manipulation
 */
function removeBookmarkById(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  return nodes
    .filter(node => !(node.type === 'bookmark' && node.id === id))
    .map(node => {
      if (node.type === 'folder') {
        return { ...node, children: removeBookmarkById(node.children, id) };
      }
      return node;
    });
}

function addBookmarkToPath(
  nodes: BookmarkNode[],
  bookmark: Bookmark,
  path: string[]
): BookmarkNode[] {
  if (path.length === 0) {
    // Add to root
    return [...nodes, bookmark];
  }

  const [currentFolder, ...remainingPath] = path;
  const folderIndex = nodes.findIndex(
    node => node.type === 'folder' && node.name === currentFolder
  );

  if (folderIndex === -1) {
    // Create folder and add bookmark
    const newFolder: BookmarkFolder = {
      id: crypto.randomUUID(),
      type: 'folder',
      name: currentFolder,
      children: addBookmarkToPath([], bookmark, remainingPath),
      addDate: new Date().getTime().toString()
    };
    return [...nodes, newFolder];
  }

  // Update existing folder
  const updatedNodes = [...nodes];
  const folder = updatedNodes[folderIndex] as BookmarkFolder;
  updatedNodes[folderIndex] = {
    ...folder,
    children: addBookmarkToPath(folder.children, bookmark, remainingPath)
  };

  return updatedNodes;
}

function ensureFolderPath(nodes: BookmarkNode[], path: string[]): BookmarkNode[] {
  if (path.length === 0) return nodes;

  const [currentFolder, ...remainingPath] = path;
  const folderIndex = nodes.findIndex(
    node => node.type === 'folder' && node.name === currentFolder
  );

  if (folderIndex === -1) {
    // Create folder
    const newFolder: BookmarkFolder = {
      id: crypto.randomUUID(),
      type: 'folder',
      name: currentFolder,
      children: ensureFolderPath([], remainingPath),
      addDate: new Date().getTime().toString()
    };
    return [...nodes, newFolder];
  }

  // Update existing folder
  const updatedNodes = [...nodes];
  const folder = updatedNodes[folderIndex] as BookmarkFolder;
  updatedNodes[folderIndex] = {
    ...folder,
    children: ensureFolderPath(folder.children, remainingPath)
  };

  return updatedNodes;
}
