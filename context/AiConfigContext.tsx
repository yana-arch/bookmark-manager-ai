import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AiConfig, AiConfigGroup } from '../types';

interface AiConfigContextType {
  aiConfigs: AiConfig[];
  activeAiConfigId: string | null;
  setActiveAiConfigId: (id: string | null) => void;
  addAiConfig: (config: Omit<AiConfig, 'id' | 'createdAt'>) => void;
  updateAiConfig: (id: string, config: Partial<AiConfig>) => void;
  deleteAiConfig: (id: string) => void;
  getActiveConfig: () => AiConfig | null;

  aiConfigGroups: AiConfigGroup[];
  activeAiConfigGroupId: string | null;
  setActiveAiConfigGroupId: (id: string | null) => void;
  addAiConfigGroup: (group: Omit<AiConfigGroup, 'id' | 'createdAt'>) => void;
  updateAiConfigGroup: (id: string, updates: Partial<AiConfigGroup>) => void;
  deleteAiConfigGroup: (id: string) => void;
  getActiveGroup: () => AiConfigGroup | null;
}

const AiConfigContext = createContext<AiConfigContextType | undefined>(undefined);

const CONFIGS_STORAGE_KEY = 'aiConfigs';
const ACTIVE_CONFIG_KEY = 'activeAiConfigId';
const GROUPS_STORAGE_KEY = 'aiConfigGroups';
const ACTIVE_GROUP_KEY = 'activeAiConfigGroupId';

export const AiConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [activeAiConfigId, setActiveAiConfigId] = useState<string | null>(null);
  const [aiConfigGroups, setAiConfigGroups] = useState<AiConfigGroup[]>([]);
  const [activeAiConfigGroupId, setActiveAiConfigGroupId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem(CONFIGS_STORAGE_KEY);
      if (storedConfigs) setAiConfigs(JSON.parse(storedConfigs));

      const storedActiveId = localStorage.getItem(ACTIVE_CONFIG_KEY);
      if (storedActiveId) setActiveAiConfigId(JSON.parse(storedActiveId));

      const storedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (storedGroups) setAiConfigGroups(JSON.parse(storedGroups));

      const storedActiveGroupId = localStorage.getItem(ACTIVE_GROUP_KEY);
      if (storedActiveGroupId) setActiveAiConfigGroupId(JSON.parse(storedActiveGroupId));

    } catch (error) {
      console.error('Failed to load AI data from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(aiConfigs));
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(aiConfigGroups));
      localStorage.setItem(ACTIVE_CONFIG_KEY, JSON.stringify(activeAiConfigId));
      localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(activeAiConfigGroupId));
    } catch (error) {
      console.error('Failed to save AI data to localStorage:', error);
    }
  }, [aiConfigs, aiConfigGroups, activeAiConfigId, activeAiConfigGroupId]);

  const addAiConfig = (config: Omit<AiConfig, 'id' | 'createdAt'>) => {
    const newConfig: AiConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setAiConfigs(prev => [...prev, newConfig]);
    if (aiConfigs.length === 0) {
      setActiveAiConfigId(newConfig.id);
    }
  };

  const updateAiConfig = (id: string, updates: Partial<AiConfig>) => {
    setAiConfigs(prev =>
      prev.map(config =>
        config.id === id ? { ...config, ...updates } : config
      )
    );
  };

  const deleteAiConfig = (id: string) => {
    setAiConfigs(prev => prev.filter(config => config.id !== id));
    if (activeAiConfigId === id) {
      setActiveAiConfigId(null);
    }
    // Also remove from any groups
    setAiConfigGroups(prevGroups => 
      prevGroups.map(group => ({
        ...group,
        aiConfigIds: group.aiConfigIds.filter(configId => configId !== id)
      }))
    );
  };

  const getActiveConfig = useCallback((): AiConfig | null => {
    if (!activeAiConfigId) return null;
    return aiConfigs.find(config => config.id === activeAiConfigId) || null;
  }, [aiConfigs, activeAiConfigId]);

  // Group Management
  const addAiConfigGroup = (group: Omit<AiConfigGroup, 'id' | 'createdAt'>) => {
    const newGroup: AiConfigGroup = {
      ...group,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setAiConfigGroups(prev => [...prev, newGroup]);
    if (aiConfigGroups.length === 0) {
      setActiveAiConfigGroupId(newGroup.id);
    }
  };

  const updateAiConfigGroup = (id: string, updates: Partial<AiConfigGroup>) => {
    setAiConfigGroups(prev =>
      prev.map(group =>
        group.id === id ? { ...group, ...updates } : group
      )
    );
  };

  const deleteAiConfigGroup = (id: string) => {
    setAiConfigGroups(prev => prev.filter(group => group.id !== id));
    if (activeAiConfigGroupId === id) {
      setActiveAiConfigGroupId(null);
    }
  };

  const getActiveGroup = useCallback((): AiConfigGroup | null => {
    if (!activeAiConfigGroupId) return null;
    return aiConfigGroups.find(group => group.id === activeAiConfigGroupId) || null;
  }, [aiConfigGroups, activeAiConfigGroupId]);

  const value: AiConfigContextType = {
    aiConfigs,
    activeAiConfigId,
    setActiveAiConfigId,
    addAiConfig,
    updateAiConfig,
    deleteAiConfig,
    getActiveConfig,
    aiConfigGroups,
    activeAiConfigGroupId,
    setActiveAiConfigGroupId,
    addAiConfigGroup,
    updateAiConfigGroup,
    deleteAiConfigGroup,
    getActiveGroup,
  };

  return (
    <AiConfigContext.Provider value={value}>
      {children}
    </AiConfigContext.Provider>
  );
};

export const useAiConfig = () => {
  const context = useContext(AiConfigContext);
  if (context === undefined) {
    throw new Error('useAiConfig must be used within an AiConfigProvider');
  }
  return context;
};
