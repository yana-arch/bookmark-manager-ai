import React, { useState, useEffect } from 'react';
import { AiConfig, AiConfigGroup, ProviderName } from '../../types';
import { useAiApi } from '../../hooks/useAiApi';
import { PROVIDER_DEFINITIONS, PREDEFINED_BASE_URLS } from '../../constants';
import { GroupManagementView } from './GroupManagementView';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Config props
  onSaveConfig: (config: AiConfig) => void;
  onDeleteConfig: (configId: string) => void;
  onSetConfigActive: (configId: string) => void;
  onEditConfig: (config: AiConfig) => void;
  editingConfig?: AiConfig | null;
  existingConfigs: AiConfig[];
  activeConfigId?: string | null;
  // Group props
  onSaveGroup: (group: Omit<AiConfigGroup, 'id' | 'createdAt'> | AiConfigGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onSetGroupActive: (groupId: string) => void;
  existingGroups: AiConfigGroup[];
  activeGroupId: string | null;
}

type ModalView = 'list' | 'form';
type ActiveTab = 'configs' | 'groups';

const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  onSaveConfig,
  onDeleteConfig,
  onSetConfigActive,
  onEditConfig,
  editingConfig,
  existingConfigs,
  activeConfigId,
  onSaveGroup,
  onDeleteGroup,
  onSetGroupActive,
  existingGroups,
  activeGroupId,
}) => {
  const [view, setView] = useState<ModalView>('list');
  const [activeTab, setActiveTab] = useState<ActiveTab>('configs');
  const [name, setName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>('gemini');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isTested, setIsTested] = useState(false);

  const { testConfig } = useAiApi();

  const isEditing = !!editingConfig;

  useEffect(() => {
    if (editingConfig) {
      setName(editingConfig.name);
      setSelectedProvider(editingConfig.provider);
      setApiKey(editingConfig.apiKey || '');
      setModelId(editingConfig.modelId);
      setBaseURL(editingConfig.baseURL || '');
      setActiveTab('configs'); // Switch to configs tab when editing a config
      setView('form');
    } else if (isOpen) {
      setView('list');
      setActiveTab('configs');
      resetForm();
    }
  }, [editingConfig, isOpen]);

  useEffect(() => {
    if (selectedProvider !== 'custom') {
      const providerDef = PROVIDER_DEFINITIONS[selectedProvider];
      if (!PROVIDER_DEFINITIONS[selectedProvider].requiresBaseURL) {
        setBaseURL(PREDEFINED_BASE_URLS[selectedProvider]);
      }
      if (!modelId || Object.values(PROVIDER_DEFINITIONS).some(p => p.defaultModelId === modelId)) {
        setModelId(providerDef.defaultModelId);
      }
    } else {
      setBaseURL('');
    }
  }, [selectedProvider, modelId]);

  useEffect(() => {
    if (isTested) {
      setIsTested(false);
      setTestResult(null);
    }
  }, [name, selectedProvider, baseURL, apiKey, modelId]);

  const resetForm = () => {
    setName('');
    setSelectedProvider('gemini');
    setBaseURL('');
    setApiKey('');
    setModelId(PROVIDER_DEFINITIONS['gemini'].defaultModelId);
    setErrors({});
    setTestResult(null);
    setIsTested(false);
    if (onEditConfig) onEditConfig(null as any); // Clear editing state
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    else if (existingConfigs.some(c => c.id !== editingConfig?.id && c.name.toLowerCase() === name.toLowerCase())) {
      newErrors.name = 'A configuration with this name already exists';
    }
    if (!modelId.trim()) newErrors.modelId = 'Model ID is required';
    if (selectedProvider === 'custom' && !baseURL.trim()) newErrors.baseURL = 'Base URL is required for custom provider';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const config: AiConfig = {
      id: editingConfig?.id || crypto.randomUUID(),
      name: name.trim(),
      provider: selectedProvider,
      baseURL: baseURL.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      modelId: modelId.trim(),
      createdAt: editingConfig?.createdAt || new Date().toISOString(),
    };
    onSaveConfig(config);
    setView('list');
    resetForm();
  };

  const handleClose = () => {
    onClose();
    setView('list');
    resetForm();
  };

  const handleAddNew = () => {
    resetForm();
    setView('form');
  };

  const handleEdit = (config: AiConfig) => {
    if (onEditConfig) onEditConfig(config);
  };

  const handleTestApi = async () => {
    if (!name.trim() || !modelId.trim() || (selectedProvider === 'custom' && !baseURL.trim())) {
      setTestResult({ success: false, message: 'Please fill in all required fields before testing.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const testAiConfig: AiConfig = {
        id: 'test', name: name.trim(), provider: selectedProvider,
        baseURL: baseURL.trim() || undefined, apiKey: apiKey.trim() || undefined, modelId: modelId.trim(),
      };
      const result = await testConfig(testAiConfig);
      setTestResult(result);
      setIsTested(true);
    } catch (error) {
      setTestResult({ success: false, message: 'Test failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
      setIsTested(true);
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderName = (config: AiConfig) => PROVIDER_DEFINITIONS[config.provider]?.name || 'Unknown';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">AI Settings</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-white" title="Close modal"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>

          <div className="border-b border-slate-600 mb-4">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button onClick={() => setActiveTab('configs')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'configs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-400'}`}>Configurations</button>
              <button onClick={() => setActiveTab('groups')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'groups' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-400'}`}>Groups</button>
            </nav>
          </div>

          {activeTab === 'configs' && (
            <>
              {view === 'list' ? (
                <div className="space-y-4">
                  {existingConfigs.length === 0 ? (
                    <div className="text-center py-8"><p className="text-slate-400 mb-4">No AI configurations found.</p><button onClick={handleAddNew} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">Add Configuration</button></div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center"><p className="text-slate-300">Manage your AI provider configurations:</p><button onClick={handleAddNew} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">Add New</button></div>
                      <div className="space-y-3">
                        {existingConfigs.map((config) => (
                          <div key={config.id} className="bg-slate-700 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2"><h3 className="font-medium text-white">{config.name}</h3>{config.id === activeConfigId && (<span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">Active</span>)}</div>
                                <p className="text-slate-400 text-sm mt-1">{getProviderName(config)} • {config.modelId}</p>
                              </div>
                              <div className="flex space-x-2">
                                {config.id !== activeConfigId && onSetConfigActive && (<button onClick={() => onSetConfigActive(config.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded">Set Active</button>)}
                                <button onClick={() => handleEdit(config)} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded">Edit</button>
                                {onDeleteConfig && (<button onClick={() => onDeleteConfig(config.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">Delete</button>)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Configuration Name *</label><input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-3 py-2 bg-slate-700 border rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-500' : 'border-slate-600'}`} placeholder="e.g., My OpenAI Config" />{errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}</div>
                  <div><label htmlFor="provider" className="block text-sm font-medium text-slate-300 mb-1">AI Provider</label><select id="provider" value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as ProviderName)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">{Object.entries(PROVIDER_DEFINITIONS).map(([key, provider]) => (<option key={key} value={key}>{provider.name}</option>))}</select></div>
                  {PROVIDER_DEFINITIONS[selectedProvider].note && (<div className="bg-blue-900/20 border border-blue-500/30 rounded-md p-3"><p className="text-blue-300 text-sm">{PROVIDER_DEFINITIONS[selectedProvider].note}</p></div>)}
                  <div><label htmlFor="baseURL" className="block text-sm font-medium text-slate-300 mb-1">Base URL {selectedProvider === 'custom' ? '*' : ''}</label><input type="url" id="baseURL" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} disabled={selectedProvider !== 'custom'} className={`w-full px-3 py-2 bg-slate-700 border rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${selectedProvider !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''} ${errors.baseURL ? 'border-red-500' : 'border-slate-600'}`} placeholder="https://api.example.com/v1" />{errors.baseURL && <p className="text-red-400 text-sm mt-1">{errors.baseURL}</p>}</div>
                  <div><label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1">API Key</label><input type="password" id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter your API key" /></div>
                  <div><label htmlFor="modelId" className="block text-sm font-medium text-slate-300 mb-1">Model ID *</label><input type="text" id="modelId" value={modelId} onChange={(e) => setModelId(e.target.value)} className={`w-full px-3 py-2 bg-slate-700 border rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.modelId ? 'border-red-500' : 'border-slate-600'}`} placeholder={`e.g., ${PROVIDER_DEFINITIONS[selectedProvider]?.defaultModelId || 'gpt-3.5-turbo'}`} />{selectedProvider !== 'custom' && (<p className="text-slate-400 text-xs mt-1">Default: {PROVIDER_DEFINITIONS[selectedProvider].defaultModelId}</p>)}{errors.modelId && <p className="text-red-400 text-sm mt-1">{errors.modelId}</p>}</div>
                  <div className="border-t border-slate-600 pt-4"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-medium text-slate-300">API Connection Test</h3><button type="button" onClick={handleTestApi} disabled={isTesting || !name.trim() || !modelId.trim() || (selectedProvider === 'custom' && !baseURL.trim())} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors flex items-center">{isTesting ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Testing...</>) : ('Test API')}</button></div>{testResult && (<div className={`p-3 rounded-md mb-3 ${testResult.success ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}><div className="flex items-center"><svg className={`w-5 h-5 mr-2 ${testResult.success ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{testResult.success ? (<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />) : (<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />)}</svg><span className={`text-sm ${testResult.success ? 'text-green-300' : 'text-red-300'}`}>{testResult.message}</span></div></div>)}{!isTested && !isTesting && (<p className="text-slate-400 text-sm mb-3">Test your API configuration before saving to ensure it works correctly.</p>)}</div>
                  <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => { setView('list'); resetForm(); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md">Back</button><button type="submit" disabled={!isTested || !testResult?.success} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md">{isEditing ? 'Update' : 'Add'} Configuration</button></div>
                </form>
              )}
            </>
          )}

          {activeTab === 'groups' && (
            <GroupManagementView 
              existingGroups={existingGroups}
              existingConfigs={existingConfigs}
              onSaveGroup={onSaveGroup}
              onDeleteGroup={onDeleteGroup}
              activeGroupId={activeGroupId}
              onSetGroupActive={onSetGroupActive}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AiConfigModal;
