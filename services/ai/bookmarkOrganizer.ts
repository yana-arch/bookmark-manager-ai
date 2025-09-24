import { Bookmark, BookmarkNode, BookmarkFolder } from '../../types';
import { getGenerativeModel } from './modelFactory';
import { AiConfig } from '../../types';

export interface OrganizationSuggestion {
  bookmarkId: string;
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
  duplicateOf?: string; // ID of duplicate bookmark if found
}

export interface OrganizationPlan {
  suggestions: OrganizationSuggestion[];
  newFolders: string[];
  conflicts: OrganizationConflict[];
  duplicates: DuplicateGroup[];
}

export interface ProcessingLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  bookmarkTitle?: string;
  bookmarkId?: string;
  provider?: string;
  statusCode?: number;
  retryCount?: number;
}

export interface OrganizationConflict {
  bookmarkId: string;
  currentCategory: string;
  suggestedCategory: string;
  confidence: number;
}

export interface DuplicateGroup {
  primaryBookmark: Bookmark;
  duplicates: Bookmark[];
  mergeStrategy: 'keep_primary' | 'keep_newest' | 'manual';
}

export class BookmarkOrganizer {
  private aiConfigs: AiConfig[];
  private activeConfigId: string | null;
  private abortController: AbortController | null = null;
  private logs: ProcessingLog[] = [];
  private onProgress?: (logs: ProcessingLog[]) => void;

  constructor(
    aiConfigs: AiConfig[],
    activeConfigId: string | null,
    options: {
      onProgress?: (logs: ProcessingLog[]) => void;
    } = {}
  ) {
    this.aiConfigs = aiConfigs;
    this.activeConfigId = activeConfigId;
    this.onProgress = options.onProgress;
  }

  /**
   * Start a cancellable operation
   */
  startOperation(): AbortController {
    this.abortController = new AbortController();
    this.logs = [];
    this.addLog('info', 'Starting bookmark organization process');
    return this.abortController;
  }

  /**
   * Cancel current operation
   */
  cancelOperation() {
    if (this.abortController) {
      this.abortController.abort();
      this.addLog('warning', 'Operation cancelled by user');
    }
  }

  /**
   * Add a log entry
   */
  private addLog(
    type: ProcessingLog['type'],
    message: string,
    options: {
      bookmarkTitle?: string;
      bookmarkId?: string;
      provider?: string;
      statusCode?: number;
      retryCount?: number;
    } = {}
  ) {
    const log: ProcessingLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
      ...options
    };

    this.logs.push(log);
    this.onProgress?.(this.logs);
  }

  /**
   * Get current logs
   */
  getLogs(): ProcessingLog[] {
    return [...this.logs];
  }

  /**
   * Comprehensive bookmark organization with advanced features
   */
  async organizeBookmarks(
    bookmarks: BookmarkNode[],
    options: {
      maxDepth?: number;
      createHierarchy?: boolean;
      detectDuplicates?: boolean;
      generateTags?: boolean;
      confidenceThreshold?: number;
    } = {}
  ): Promise<OrganizationPlan> {
    const {
      maxDepth = 3,
      createHierarchy = true,
      detectDuplicates = true,
      generateTags = true,
      confidenceThreshold = 0.7
    } = options;

    // Extract all bookmarks from the tree
    const allBookmarks = this.extractBookmarks(bookmarks);

    // Phase 1: Duplicate detection
    const duplicates = detectDuplicates ? await this.detectDuplicates(allBookmarks) : [];

    // Phase 2: Smart categorization with hierarchy
    const suggestions = await this.generateSmartSuggestions(
      allBookmarks,
      maxDepth,
      createHierarchy,
      generateTags,
      confidenceThreshold
    );

    // Phase 3: Conflict resolution
    const conflicts = this.identifyConflicts(suggestions, bookmarks);

    // Phase 4: Generate new folder structure
    const newFolders = this.generateFolderStructure(suggestions, createHierarchy);

    return {
      suggestions,
      newFolders,
      conflicts,
      duplicates
    };
  }

  /**
   * Extract all bookmarks from nested folder structure
   */
  private extractBookmarks(nodes: BookmarkNode[]): Bookmark[] {
    const bookmarks: Bookmark[] = [];

    const traverse = (nodes: BookmarkNode[], currentPath: string[] = []) => {
      for (const node of nodes) {
        if (node.type === 'bookmark') {
          bookmarks.push({
            ...node,
            // Add context about current location
            currentPath: currentPath.join(' > ')
          } as Bookmark & { currentPath: string });
        } else if (node.type === 'folder') {
          traverse(node.children, [...currentPath, node.name]);
        }
      }
    };

    traverse(nodes);
    return bookmarks;
  }

  /**
   * Detect duplicate bookmarks using multiple strategies
   */
  private async detectDuplicates(bookmarks: Bookmark[]): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];

    // Strategy 1: Exact URL matches
    const urlMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
      const url = bookmark.url.toLowerCase().trim();
      if (!urlMap.has(url)) {
        urlMap.set(url, []);
      }
      urlMap.get(url)!.push(bookmark);
    }

    // Strategy 2: Similar titles (using AI for fuzzy matching)
    const titleMap = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
      const normalizedTitle = bookmark.title.toLowerCase().trim();
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle)!.push(bookmark);
    }

    // Process URL duplicates
    for (const [url, bookmarkGroup] of urlMap) {
      if (bookmarkGroup.length > 1) {
        const primary = this.selectPrimaryBookmark(bookmarkGroup);
        const duplicates = bookmarkGroup.filter(b => b.id !== primary.id);
        groups.push({
          primaryBookmark: primary,
          duplicates,
          mergeStrategy: 'keep_primary'
        });
      }
    }

    // Process title similarities (AI-powered)
    const model = getGenerativeModel(this.aiConfigs, this.activeConfigId);
    for (const [title, bookmarkGroup] of titleMap) {
      if (bookmarkGroup.length > 1 && bookmarkGroup.length <= 5) {
        // Only check small groups to avoid API spam
        const similarGroups = await this.findSimilarBookmarks(bookmarkGroup, model);
        groups.push(...similarGroups);
      }
    }

    return groups;
  }

  /**
   * Generate smart categorization suggestions with hierarchy
   */
  private async generateSmartSuggestions(
    bookmarks: Bookmark[],
    maxDepth: number,
    createHierarchy: boolean,
    generateTags: boolean,
    confidenceThreshold: number
  ): Promise<OrganizationSuggestion[]> {
    const model = getGenerativeModel(this.aiConfigs, this.activeConfigId);
    const suggestions: OrganizationSuggestion[] = [];
    let retryCount = 0;
    const maxRetries = 3;

    this.addLog('info', `Starting categorization of ${bookmarks.length} bookmarks`);

    // Process in batches to avoid rate limits
    const batchSize = 1; // Process one at a time for better control
    for (let i = 0; i < bookmarks.length; i++) {
      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        this.addLog('warning', 'Categorization cancelled during processing');
        break;
      }

      const bookmark = bookmarks[i];
      this.addLog('info', `Processing bookmark: ${bookmark.title}`, {
        bookmarkTitle: bookmark.title,
        bookmarkId: bookmark.id
      });

      const prompt = this.buildCategorizationPrompt(
        bookmark,
        maxDepth,
        createHierarchy,
        generateTags
      );

      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        try {
          // Check for cancellation before each attempt
          if (this.abortController?.signal.aborted) {
            this.addLog('warning', `Cancelled processing of "${bookmark.title}"`);
            break;
          }

          const response = await model.generateContent(prompt);
          const suggestion = this.parseAISuggestion(response.text, bookmark.id);

          if (suggestion.confidence >= confidenceThreshold) {
            suggestions.push(suggestion);
            this.addLog('success', `Successfully categorized "${bookmark.title}" (${Math.round(suggestion.confidence * 100)}% confidence)`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id
            });
            success = true;
          } else {
            this.addLog('warning', `Low confidence for "${bookmark.title}" (${Math.round(suggestion.confidence * 100)}%) - skipping`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id
            });
            success = true; // Don't retry for low confidence
          }

        } catch (error: any) {
          attempt++;
          const errorMessage = error?.message || 'Unknown error';
          const statusCode = error?.status || error?.code;

          this.addLog('error', `Failed to categorize "${bookmark.title}": ${errorMessage}`, {
            bookmarkTitle: bookmark.title,
            bookmarkId: bookmark.id,
            provider: this.activeConfigId || 'unknown',
            statusCode,
            retryCount: attempt
          });

          // Handle specific error codes
          if (statusCode === 429) {
            // Rate limit - wait longer
            const waitTime = Math.min(30000 * Math.pow(2, attempt), 300000); // Exponential backoff, max 5 minutes
            this.addLog('warning', `Rate limit hit for "${bookmark.title}". Waiting ${waitTime/1000}s before retry ${attempt}/${maxRetries}`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id,
              statusCode: 429,
              retryCount: attempt
            });

            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else if (statusCode === 404) {
            // Endpoint not found - don't retry
            this.addLog('error', `Endpoint not found for "${bookmark.title}". Skipping.`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id,
              statusCode: 404
            });
            break;
          } else if (statusCode === 401 || statusCode === 403) {
            // Auth error - don't retry
            this.addLog('error', `Authentication error for "${bookmark.title}". Check API key.`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id,
              statusCode
            });
            break;
          } else if (attempt < maxRetries) {
            // Other errors - retry with shorter delay
            const waitTime = 2000 * attempt;
            this.addLog('warning', `Retrying "${bookmark.title}" in ${waitTime/1000}s (attempt ${attempt}/${maxRetries})`, {
              bookmarkTitle: bookmark.title,
              bookmarkId: bookmark.id,
              retryCount: attempt
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (!success && attempt >= maxRetries) {
        this.addLog('error', `Failed to categorize "${bookmark.title}" after ${maxRetries} attempts`, {
          bookmarkTitle: bookmark.title,
          bookmarkId: bookmark.id,
          retryCount: maxRetries
        });
      }

      // Progress update
      const progress = Math.round(((i + 1) / bookmarks.length) * 100);
      this.addLog('info', `Progress: ${i + 1}/${bookmarks.length} bookmarks processed (${progress}%)`);

      // Small delay between bookmarks
      if (i < bookmarks.length - 1 && !this.abortController?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.addLog('success', `Categorization complete. Generated ${suggestions.length} suggestions from ${bookmarks.length} bookmarks`);
    return suggestions;
  }

  /**
   * Build sophisticated categorization prompt
   */
  private buildCategorizationPrompt(
    bookmark: Bookmark & { currentPath?: string },
    maxDepth: number,
    createHierarchy: boolean,
    generateTags: boolean
  ): string {
    const hierarchyInstruction = createHierarchy
      ? `Create a hierarchical category structure using " > " separator (max ${maxDepth} levels).`
      : "Suggest a single category name.";

    const tagInstruction = generateTags
      ? "Also suggest 3-5 relevant tags for better organization and search."
      : "";

    return `
You are an expert bookmark organizer. Analyze this bookmark and suggest the optimal organization.

Bookmark Details:
- Title: "${bookmark.title}"
- URL: "${bookmark.url}"
- Current Location: "${bookmark.currentPath || 'Root'}"
- Description/Tags: "${bookmark.tags?.join(', ') || 'None'}"

Task:
1. ${hierarchyInstruction}
2. Provide a confidence score (0.0-1.0) for your suggestion.
3. Explain your reasoning briefly.
${tagInstruction}

Consider:
- Content type (article, tool, tutorial, reference, etc.)
- Topic domain (technology, design, business, education, etc.)
- Use case (work, personal, research, entertainment, etc.)
- Existing organizational patterns

Response Format (JSON):
{
  "category": "Technology > Development > Tools",
  "confidence": 0.85,
  "reasoning": "This is a development tool based on the URL pattern and title",
  "tags": ["development", "tools", "productivity", "web"]
}
`;
  }

  /**
   * Parse AI response into structured suggestion
   */
  private parseAISuggestion(response: string, bookmarkId: string): OrganizationSuggestion {
    try {
      const parsed = JSON.parse(response.trim());
      return {
        bookmarkId,
        suggestedCategory: parsed.category || 'Uncategorized',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        reasoning: parsed.reasoning || 'AI-generated suggestion',
        suggestedTags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
    } catch (error) {
      // Fallback parsing for non-JSON responses
      const categoryMatch = response.match(/["']?category["']?\s*:\s*["']([^"']+)["']/i);
      const confidenceMatch = response.match(/["']?confidence["']?\s*:\s*([0-9.]+)/i);

      return {
        bookmarkId,
        suggestedCategory: categoryMatch ? categoryMatch[1] : 'Uncategorized',
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: 'Parsed from AI response',
        suggestedTags: []
      };
    }
  }

  /**
   * Identify conflicts between current and suggested organization
   */
  private identifyConflicts(
    suggestions: OrganizationSuggestion[],
    currentBookmarks: BookmarkNode[]
  ): OrganizationConflict[] {
    const conflicts: OrganizationConflict[] = [];

    // Build current location map
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
      const suggestedLocation = suggestion.suggestedCategory;

      // Check if they're different and confidence is high
      if (currentLocation !== suggestedLocation && suggestion.confidence > 0.8) {
        conflicts.push({
          bookmarkId: suggestion.bookmarkId,
          currentCategory: currentLocation,
          suggestedCategory: suggestedLocation,
          confidence: suggestion.confidence
        });
      }
    }

    return conflicts;
  }

  /**
   * Generate optimal folder structure from suggestions
   */
  private generateFolderStructure(
    suggestions: OrganizationSuggestion[],
    createHierarchy: boolean
  ): string[] {
    const folders = new Set<string>();

    for (const suggestion of suggestions) {
      if (createHierarchy) {
        // Split hierarchical categories
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

  /**
   * Select primary bookmark from duplicates
   */
  private selectPrimaryBookmark(bookmarks: Bookmark[]): Bookmark {
    // Prefer bookmarks with more metadata
    return bookmarks.reduce((primary, current) => {
      const primaryScore = this.getBookmarkScore(primary);
      const currentScore = this.getBookmarkScore(current);
      return currentScore > primaryScore ? current : primary;
    });
  }

  /**
   * Score bookmark based on metadata completeness
   */
  private getBookmarkScore(bookmark: Bookmark): number {
    let score = 0;
    if (bookmark.title) score += 2;
    if (bookmark.tags && bookmark.tags.length > 0) score += 1;
    if (bookmark.addDate) score += 1;
    if (bookmark.icon) score += 1;
    return score;
  }

  /**
   * Find similar bookmarks using AI
   */
  private async findSimilarBookmarks(
    bookmarks: Bookmark[],
    model: any
  ): Promise<DuplicateGroup[]> {
    if (bookmarks.length < 2) return [];

    const groups: DuplicateGroup[] = [];

    // Compare each pair
    for (let i = 0; i < bookmarks.length; i++) {
      for (let j = i + 1; j < bookmarks.length; j++) {
        const bookmark1 = bookmarks[i];
        const bookmark2 = bookmarks[j];

        const similarity = await this.calculateSimilarity(bookmark1, bookmark2, model);

        if (similarity > 0.8) { // High similarity threshold
          const primary = this.selectPrimaryBookmark([bookmark1, bookmark2]);
          const duplicate = primary.id === bookmark1.id ? bookmark2 : bookmark1;

          // Check if already in a group
          const existingGroup = groups.find(g =>
            g.primaryBookmark.id === primary.id ||
            g.duplicates.some(d => d.id === primary.id)
          );

          if (existingGroup) {
            if (!existingGroup.duplicates.some(d => d.id === duplicate.id)) {
              existingGroup.duplicates.push(duplicate);
            }
          } else {
            groups.push({
              primaryBookmark: primary,
              duplicates: [duplicate],
              mergeStrategy: 'keep_primary'
            });
          }
        }
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two bookmarks using AI
   */
  private async calculateSimilarity(
    bookmark1: Bookmark,
    bookmark2: Bookmark,
    model: any
  ): Promise<number> {
    const prompt = `
Compare these two bookmarks and determine if they are duplicates or very similar:

Bookmark 1:
- Title: "${bookmark1.title}"
- URL: "${bookmark1.url}"

Bookmark 2:
- Title: "${bookmark2.title}"
- URL: "${bookmark2.url}"

Return only a number between 0.0 and 1.0 indicating similarity (1.0 = identical, 0.0 = completely different).
Consider: title similarity, URL similarity, content type, purpose.
`;

    try {
      const response = await model.generateContent(prompt);
      const similarity = parseFloat(response.text.trim());
      return isNaN(similarity) ? 0 : Math.max(0, Math.min(1, similarity));
    } catch (error) {
      return 0;
    }
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
