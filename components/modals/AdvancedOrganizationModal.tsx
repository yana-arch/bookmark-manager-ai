import React, { useState, useEffect } from 'react';
import { BookmarkNode } from '../../types';
import { OrganizationPlan, OrganizationSuggestion, OrganizationConflict, DuplicateGroup, ProcessingLog } from '../../services/ai/bookmarkOrganizer';
import { useAiApi } from '../../hooks/useAiApi';
import { useAiConfig } from '../../context/AiConfigContext';
import { BookmarkTreeView } from '../BookmarkTreeView';

interface AdvancedOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkNode[];
  onApplyOrganization: (organizedBookmarks: BookmarkNode[]) => void;
}

type Step = 'config' | 'analyzing' | 'review' | 'applying';

export const AdvancedOrganizationModal: React.FC<AdvancedOrganizationModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onApplyOrganization,
}) => {
  const [step, setStep] = useState<Step>('config');
  const [organizationPlan, setOrganizationPlan] = useState<OrganizationPlan | null>(null);
  const [previewBookmarks, setPreviewBookmarks] = useState<BookmarkNode[] | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Configuration options
  const [options, setOptions] = useState({
    maxDepth: 3,
    createHierarchy: true,
    detectDuplicates: true,
    generateTags: true,
    confidenceThreshold: 0.7,
    batchSize: 20, // New option for parallel batch size
  });

  const {
    organizeBookmarks, 
    applyOrganization, 
    isLoading, 
    error, 
    organizationProgress 
  } = useAiApi();
  const configContext = useAiConfig();
  console.log('AI Config Context:', configContext);
  const { aiConfigGroups, activeAiConfigGroupId, setActiveAiConfigGroupId } = configContext;


  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setOrganizationPlan(null);
      setProcessingLogs([]);
    }
  }, [isOpen]);

  const handleStartAnalysis = async () => {
    if (!activeAiConfigGroupId) {
      alert("Please select an AI provider group first.");
      return;
    }
    setStep('analyzing');
    setProcessingLogs([]);
    setPreviewBookmarks(null);
    setHighlightedNodes(new Set());

    try {
      const optionsWithGroup = { ...options, groupId: activeAiConfigGroupId };
      const { plan, controller } = await organizeBookmarks(bookmarks, optionsWithGroup, (progress) => {
        setProcessingLogs(progress.logs);
      });

      setOrganizationPlan(plan);
      setAbortController(controller);

      const preview = applyOrganization(bookmarks, plan);
      setPreviewBookmarks(preview);

      const affectedIds = new Set<string>();
      plan.suggestions.forEach(s => affectedIds.add(s.bookmarkId));
      plan.duplicates.forEach(g => g.duplicates.forEach(d => affectedIds.add(d.id)));
      setHighlightedNodes(affectedIds);

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

    setStep('applying');
    try {
      // The entire plan is applied, as approved by the user in the preview
      const organizedBookmarks = applyOrganization(bookmarks, organizationPlan);
      onApplyOrganization(organizedBookmarks);
      onClose();
    } catch (err) {
      console.error('Failed to apply organization:', err);
      setStep('review');
    }
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
                <h3 className="text-lg font-medium text-white mb-4">Select AI Provider Group</h3>
                <select
                  value={activeAiConfigGroupId || ''}
                  onChange={(e) => setActiveAiConfigGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>-- Select a Group --</option>
                  {aiConfigGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                {aiConfigGroups.length === 0 && (
                    <p className="text-sm text-slate-400 mt-2">No AI groups configured. Please create a group in the AI Settings.</p>
                )}
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2">What this will do:</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Analyze all {bookmarks.length} bookmarks using parallel AI batches</li>
                  <li>• Suggest optimal categorization with confidence scores</li>
                  {options.detectDuplicates && <li>• Identify and suggest merging of duplicate bookmarks</li>}
                  {options.generateTags && <li>• Generate relevant tags for better searchability</li>}
                  {options.createHierarchy && <li>• Create hierarchical folder structure (max {options.maxDepth} levels)</li>}
                  <li>• Allow you to review and approve changes before applying</li>
                </ul>
                                  <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                                    <p className="text-xs text-blue-300">
                                      💡 <strong>Parallel Processing:</strong> Processes bookmarks in multiple batches at once for maximum speed.
                                    </p>
                                  </div>              </div>

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
                  disabled={isLoading || !activeAiConfigGroupId}
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
            <div className="space-y-4">
              <div className="text-center pt-4">
                <h3 className="text-lg font-medium text-white mb-2">Analyzing Bookmarks</h3>
                <p className="text-slate-400">AI is processing your bookmarks in parallel batches...</p>
              </div>

              {/* Progress Bar */}
              <div>
                {organizationProgress && (
                  <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(organizationProgress.processed / organizationProgress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
                <div className="flex justify-between text-sm text-slate-400 mt-2">
                  <span>
                    {organizationProgress ? `Processing batch ${organizationProgress.processed} of ${organizationProgress.total}` : 'Initializing...'}
                  </span>
                  <span>
                    {organizationProgress ? `${Math.round((organizationProgress.processed / organizationProgress.total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>

              {/* Processing Logs */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white">Processing Logs</h4>
                  <button
                    onClick={handleCancelAnalysis}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    Cancel Analysis
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-slate-800 rounded">
                  {processingLogs.length === 0 ? (
                    <p className="text-slate-400 text-sm">Starting analysis...</p>
                  ) : (
                    [...processingLogs].reverse().map((log) => (
                      <div key={log.id} className={`text-xs p-2 rounded-md ${
                        log.type === 'error' ? 'bg-red-900/30 text-red-300' :
                        log.type === 'warning' ? 'bg-yellow-900/30 text-yellow-300' :
                        log.type === 'success' ? 'bg-green-900/30 text-green-300' :
                        'bg-slate-700/40 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {log.type.toUpperCase()}
                          </span>
                          <span className="text-slate-500">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 font-mono">{log.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'review' && organizationPlan && previewBookmarks && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-white">Review Proposed Changes</h3>
                <p className="text-sm text-slate-400">The AI has generated a new structure. Review the changes below before applying.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BookmarkTreeView title="Before" nodes={bookmarks} highlightedNodes={highlightedNodes} />
                <BookmarkTreeView title="After" nodes={previewBookmarks} highlightedNodes={highlightedNodes} />
              </div>

              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h4 className="font-semibold text-white mb-2">Summary of Changes:</h4>
                <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                  <li><span className="font-bold text-green-400">{organizationPlan.suggestions.length}</span> bookmarks suggested to be moved or re-categorized.</li>
                  <li><span className="font-bold text-yellow-400">{organizationPlan.newFolders.length}</span> new folders to be created.</li>
                  <li><span className="font-bold text-red-400">{organizationPlan.duplicates.length}</span> duplicate groups to be merged.</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setStep('config')}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors"
                >
                  Back to Config
                </button>
                <button
                  onClick={handleApplyOrganization}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors shadow-md"
                >
                  Apply New Structure
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


