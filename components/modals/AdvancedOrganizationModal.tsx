import React, { useState, useEffect } from 'react';
import { BookmarkNode } from '../../types';
import { OrganizationPlan, OrganizationSuggestion, OrganizationConflict, DuplicateGroup, ProcessingLog } from '../../services/ai/bookmarkOrganizer';
import { useAiApi } from '../../hooks/useAiApi';

interface AdvancedOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkNode[];
  onApplyOrganization: (organizedBookmarks: BookmarkNode[]) => void;
}

type Step = 'config' | 'analyzing' | 'review' | 'applying';

const AdvancedOrganizationModal: React.FC<AdvancedOrganizationModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onApplyOrganization,
}) => {
  const [step, setStep] = useState<Step>('config');
  const [organizationPlan, setOrganizationPlan] = useState<OrganizationPlan | null>(null);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Configuration options
  const [options, setOptions] = useState({
    maxDepth: 3,
    createHierarchy: true,
    detectDuplicates: true,
    generateTags: true,
    confidenceThreshold: 0.7,
    processingMode: 'individual', // 'individual' | 'batch'
  });

  const { organizeBookmarks, applyOrganization, isLoading, error } = useAiApi();

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setOrganizationPlan(null);
      setSelectedSuggestions(new Set());
      setSelectedDuplicates(new Set());
    }
  }, [isOpen]);

  const handleStartAnalysis = async () => {
    setStep('analyzing');
    setProcessingLogs([]);
    try {
      const result = await organizeBookmarks(bookmarks, options);
      const { plan, controller, logs } = result;

      setOrganizationPlan(plan);
      setProcessingLogs(logs);
      setAbortController(controller);

      // Auto-select all high-confidence suggestions
      const highConfidenceIds = plan.suggestions
        .filter(s => s.confidence >= 0.8)
        .map(s => s.bookmarkId);
      setSelectedSuggestions(new Set(highConfidenceIds));

      // Auto-select all duplicates for merging
      const duplicateIds = plan.duplicates
        .flatMap(group => group.duplicates.map(d => d.id));
      setSelectedDuplicates(new Set(duplicateIds));

      setStep('review');
    } catch (err) {
      console.error('Organization analysis failed:', err);
      setStep('config');
    }
  };

  const handleCancelAnalysis = () => {
    if (abortController) {
      abortController.abort();
      setProcessingLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'warning',
        message: 'Analysis cancelled by user'
      }]);
      setStep('config');
    }
  };

  const handleApplyOrganization = () => {
    if (!organizationPlan) return;

    // Filter suggestions based on user selection
    const filteredPlan: OrganizationPlan = {
      ...organizationPlan,
      suggestions: organizationPlan.suggestions.filter(s =>
        selectedSuggestions.has(s.bookmarkId)
      ),
      duplicates: organizationPlan.duplicates.filter(group =>
        group.duplicates.some(d => selectedDuplicates.has(d.id))
      ),
    };

    setStep('applying');
    try {
      const organizedBookmarks = applyOrganization(bookmarks, filteredPlan);
      onApplyOrganization(organizedBookmarks);
      onClose();
    } catch (err) {
      console.error('Failed to apply organization:', err);
      setStep('review');
    }
  };

  const toggleSuggestion = (bookmarkId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(bookmarkId)) {
      newSelected.delete(bookmarkId);
    } else {
      newSelected.add(bookmarkId);
    }
    setSelectedSuggestions(newSelected);
  };

  const toggleDuplicate = (bookmarkId: string) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(bookmarkId)) {
      newSelected.delete(bookmarkId);
    } else {
      newSelected.add(bookmarkId);
    }
    setSelectedDuplicates(newSelected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              Advanced Bookmark Organization
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center mb-6">
            {['config', 'analyzing', 'review', 'applying'].map((stepName, index) => (
              <React.Fragment key={stepName}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === stepName
                    ? 'bg-indigo-600 text-white'
                    : ['analyzing', 'review', 'applying'].includes(step) && ['config', 'analyzing', 'review', 'applying'].indexOf(step) >= index
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-600 text-slate-400'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    ['analyzing', 'review', 'applying'].includes(step) && ['config', 'analyzing', 'review', 'applying'].indexOf(step) > index
                      ? 'bg-green-600'
                      : 'bg-slate-600'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {step === 'config' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Organization Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Maximum Hierarchy Depth
                    </label>
                    <select
                      value={options.maxDepth}
                      onChange={(e) => setOptions(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1}>1 Level</option>
                      <option value={2}>2 Levels</option>
                      <option value={3}>3 Levels</option>
                      <option value={4}>4 Levels</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Confidence Threshold
                    </label>
                    <select
                      value={options.confidenceThreshold}
                      onChange={(e) => setOptions(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0.5}>Low (0.5)</option>
                      <option value={0.7}>Medium (0.7)</option>
                      <option value={0.8}>High (0.8)</option>
                      <option value={0.9}>Very High (0.9)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Processing Mode
                    </label>
                    <select
                      value={options.processingMode}
                      onChange={(e) => setOptions(prev => ({ ...prev, processingMode: e.target.value as 'individual' | 'batch' }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="individual">Individual (1 by 1)</option>
                      <option value="batch">Batch (All at once)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.createHierarchy}
                      onChange={(e) => setOptions(prev => ({ ...prev, createHierarchy: e.target.checked }))}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Create hierarchical folder structure</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.detectDuplicates}
                      onChange={(e) => setOptions(prev => ({ ...prev, detectDuplicates: e.target.checked }))}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Detect and merge duplicate bookmarks</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.generateTags}
                      onChange={(e) => setOptions(prev => ({ ...prev, generateTags: e.target.checked }))}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Generate AI-powered tags for bookmarks</span>
                  </label>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2">What this will do:</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Analyze all {bookmarks.length} bookmarks using AI</li>
                  <li>• <strong>Processing Mode:</strong> {options.processingMode === 'batch' ? 'Batch (all at once - faster)' : 'Individual (1 by 1 - more reliable)'}</li>
                  <li>• Suggest optimal categorization with confidence scores</li>
                  {options.detectDuplicates && <li>• Identify and suggest merging of duplicate bookmarks</li>}
                  {options.generateTags && <li>• Generate relevant tags for better searchability</li>}
                  {options.createHierarchy && <li>• Create hierarchical folder structure (max {options.maxDepth} levels)</li>}
                  <li>• Allow you to review and approve changes before applying</li>
                </ul>
                {options.processingMode === 'batch' && (
                  <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Batch Mode:</strong> Processes all bookmarks in one AI request. Faster but may hit token limits with many bookmarks.
                    </p>
                  </div>
                )}
                {options.processingMode === 'individual' && (
                  <div className="mt-3 p-2 bg-green-900/20 border border-green-500/30 rounded">
                    <p className="text-xs text-green-300">
                      🛡️ <strong>Individual Mode:</strong> Processes one bookmark at a time. Slower but more reliable and provides detailed progress.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-md p-3">
                  <p className="text-red-300 text-sm">{error.message}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartAnalysis}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    'Start Analysis'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-white mb-2">Analyzing Bookmarks</h3>
                <p className="text-slate-400">AI is analyzing your bookmarks and generating organization suggestions...</p>
              </div>

              {/* Processing Logs */}
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white">Processing Logs</h4>
                  <button
                    onClick={handleCancelAnalysis}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    Cancel Analysis
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {processingLogs.length === 0 ? (
                    <p className="text-slate-400 text-sm">Starting analysis...</p>
                  ) : (
                    processingLogs.slice(-10).map((log) => (
                      <div key={log.id} className={`text-xs p-2 rounded ${
                        log.type === 'error' ? 'bg-red-900/20 text-red-300' :
                        log.type === 'warning' ? 'bg-yellow-900/20 text-yellow-300' :
                        log.type === 'success' ? 'bg-green-900/20 text-green-300' :
                        'bg-slate-600/20 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {log.bookmarkTitle ? `"${log.bookmarkTitle}"` : 'System'}
                          </span>
                          <span className="text-slate-500">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1">{log.message}</p>
                        {log.statusCode && (
                          <p className="text-slate-500 mt-1">Status: {log.statusCode}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'review' && organizationPlan && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Suggestions</h4>
                  <p className="text-2xl font-bold text-indigo-400">{organizationPlan.suggestions.length}</p>
                  <p className="text-xs text-slate-400">AI categorization suggestions</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Conflicts</h4>
                  <p className="text-2xl font-bold text-yellow-400">{organizationPlan.conflicts.length}</p>
                  <p className="text-xs text-slate-400">Potential conflicts detected</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Duplicates</h4>
                  <p className="text-2xl font-bold text-red-400">{organizationPlan.duplicates.length}</p>
                  <p className="text-xs text-slate-400">Duplicate groups found</p>
                </div>
              </div>

              {/* Organization Suggestions */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Organization Suggestions</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {organizationPlan.suggestions.map((suggestion) => (
                    <div key={suggestion.bookmarkId} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedSuggestions.has(suggestion.bookmarkId)}
                              onChange={() => toggleSuggestion(suggestion.bookmarkId)}
                              className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-white">
                              Move to: {suggestion.suggestedCategory}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              suggestion.confidence >= 0.8 ? 'bg-green-600 text-white' :
                              suggestion.confidence >= 0.6 ? 'bg-yellow-600 text-white' :
                              'bg-red-600 text-white'
                            }`}>
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mb-1">{suggestion.reasoning}</p>
                          {suggestion.suggestedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {suggestion.suggestedTags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 text-xs bg-slate-600 text-slate-300 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Duplicate Groups */}
              {organizationPlan.duplicates.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Duplicate Bookmarks</h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {organizationPlan.duplicates.map((group, index) => (
                      <div key={index} className="bg-slate-700 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-green-400">Keep:</span>
                          <span className="text-sm text-white">{group.primaryBookmark.title}</span>
                        </div>
                        <div className="space-y-1">
                          {group.duplicates.map((duplicate) => (
                            <div key={duplicate.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedDuplicates.has(duplicate.id)}
                                onChange={() => toggleDuplicate(duplicate.id)}
                                className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-slate-400">Remove duplicate: {duplicate.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {organizationPlan.conflicts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Potential Conflicts</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {organizationPlan.conflicts.map((conflict, index) => (
                      <div key={index} className="bg-yellow-900/20 border border-yellow-500/30 rounded-md p-3">
                        <p className="text-yellow-300 text-sm">
                          Bookmark conflicts with existing organization (confidence: {Math.round(conflict.confidence * 100)}%)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStep('config')}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleApplyOrganization}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                >
                  Apply Organization ({selectedSuggestions.size} changes, {selectedDuplicates.size} duplicates)
                </button>
              </div>
            </div>
          )}

          {step === 'applying' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-white mb-2">Applying Organization</h3>
              <p className="text-slate-400">Reorganizing your bookmarks...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedOrganizationModal;
