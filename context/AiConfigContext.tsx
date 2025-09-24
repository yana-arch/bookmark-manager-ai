import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AiConfig } from '../types';

interface AiConfigContextType {
  aiConfigs: AiConfig[];
  activeAiConfigId: string | null;
  setActiveAiConfigId: (id: string | null) => void;
  addAiConfig: (config: Omit<AiConfig, 'id' | 'createdAt'>) => void;
  updateAiConfig: (id: string, config: Partial<AiConfig>) => void;
  deleteAiConfig: (id: string) => void;
  getActiveConfig: () => AiConfig | null;
}

const AiConfigContext = createContext<AiConfigContextType | undefined>(undefined);

const STORAGE_KEY = 'aiConfigs';
const ACTIVE_CONFIG_KEY = 'activeAiConfigId';

export const AiConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [activeAiConfigId, setActiveAiConfigId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem(STORAGE_KEY);
      const storedActiveId = localStorage.getItem(ACTIVE_CONFIG_KEY);

      if (storedConfigs) {
        const parsedConfigs = JSON.parse(storedConfigs);
        setAiConfigs(parsedConfigs);
      }

      if (storedActiveId) {
        setActiveAiConfigId(storedActiveId);
      }
    } catch (error) {
      console.error('Failed to load AI configs from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever configs change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(aiConfigs));
    } catch (error) {
      console.error('Failed to save AI configs to localStorage:', error);
    }
  }, [aiConfigs]);

  // Save active config ID
  useEffect(() => {
    try {
      if (activeAiConfigId) {
        localStorage.setItem(ACTIVE_CONFIG_KEY, activeAiConfigId);
      } else {
        localStorage.removeItem(ACTIVE_CONFIG_KEY);
      }
    } catch (error) {
      console.error('Failed to save active AI config ID to localStorage:', error);
    }
  }, [activeAiConfigId]);

  const addAiConfig = (config: Omit<AiConfig, 'id' | 'createdAt'>) => {
    const newConfig: AiConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    setAiConfigs(prev => [...prev, newConfig]);

    // If this is the first config or marked as default, make it active
    if (aiConfigs.length === 0 || config.isDefault) {
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

    // If deleting the active config, clear it
    if (activeAiConfigId === id) {
      setActiveAiConfigId(null);
    }
  };

  const getActiveConfig = (): AiConfig | null => {
    if (!activeAiConfigId) return null;
    return aiConfigs.find(config => config.id === activeAiConfigId) || null;
  };

  const value: AiConfigContextType = {
    aiConfigs,
    activeAiConfigId,
    setActiveAiConfigId,
    addAiConfig,
    updateAiConfig,
    deleteAiConfig,
    getActiveConfig,
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
