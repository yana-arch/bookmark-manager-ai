import React, { useState, useEffect } from 'react';
import { AiConfig, AiConfigGroup } from '../../types';

interface GroupManagementViewProps {
  existingGroups: AiConfigGroup[];
  existingConfigs: AiConfig[];
  onSaveGroup: (group: Omit<AiConfigGroup, 'id' | 'createdAt'> | AiConfigGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  activeGroupId: string | null;
  onSetGroupActive: (groupId: string) => void;
}

export const GroupManagementView: React.FC<GroupManagementViewProps> = ({
  existingGroups,
  existingConfigs,
  onSaveGroup,
  onDeleteGroup,
  activeGroupId,
  onSetGroupActive,
}) => {
  const [editingGroup, setEditingGroup] = useState<AiConfigGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
  const [isFormVisible, setIsFormVisible] = useState(false);

  useEffect(() => {
    if (editingGroup) {
      setGroupName(editingGroup.name);
      setSelectedConfigIds(new Set(editingGroup.aiConfigIds));
      setIsFormVisible(true);
    } else {
      resetForm();
    }
  }, [editingGroup]);

  const resetForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setSelectedConfigIds(new Set());
    setIsFormVisible(false);
  };

  const handleToggleConfigSelection = (configId: string) => {
    const newSelection = new Set(selectedConfigIds);
    if (newSelection.has(configId)) {
      newSelection.delete(configId);
    } else {
      newSelection.add(configId);
    }
    setSelectedConfigIds(newSelection);
  };

  const handleSaveGroup = () => {
    if (!groupName.trim() || selectedConfigIds.size === 0) {
      // Basic validation
      alert('Group name and at least one AI configuration are required.');
      return;
    }

    const groupData = {
      name: groupName.trim(),
      aiConfigIds: Array.from(selectedConfigIds),
    };

    if (editingGroup) {
      onSaveGroup({ ...editingGroup, ...groupData });
    } else {
      onSaveGroup(groupData as Omit<AiConfigGroup, 'id' | 'createdAt'>);
    }

    resetForm();
  };

  const handleEditGroup = (group: AiConfigGroup) => {
    setEditingGroup(group);
  };

  const handleAddNew = () => {
    resetForm();
    setIsFormVisible(true);
  };

  return (
    <div className="space-y-4">
      {isFormVisible ? (
        <div className="p-4 bg-slate-700/50 rounded-lg space-y-4">
          <h3 className="text-lg font-medium text-white">{editingGroup ? 'Edit Group' : 'Create New Group'}</h3>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
              placeholder="e.g., Fast Providers"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Select AI Configurations</label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-800 rounded-md">
              {existingConfigs.map(config => (
                <label key={config.id} className="flex items-center p-2 rounded-md hover:bg-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedConfigIds.has(config.id)}
                    onChange={() => handleToggleConfigSelection(config.id)}
                    className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm text-slate-200">{config.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button onClick={resetForm} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md">
              Cancel
            </button>
            <button onClick={handleSaveGroup} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">
              {editingGroup ? 'Update Group' : 'Save Group'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <p className="text-slate-300">Manage your AI provider groups:</p>
          <button onClick={handleAddNew} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">
            Add New Group
          </button>
        </div>
      )}

      <div className="space-y-3">
        {existingGroups.map(group => (
          <div key={group.id} className="bg-slate-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-white">{group.name}</h3>
                  {group.id === activeGroupId && (
                    <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">Active</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {group.aiConfigIds.map(id => {
                    const config = existingConfigs.find(c => c.id === id);
                    return (
                      <span key={id} className="px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded-md">
                        {config?.name || 'Unknown Config'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex space-x-2">
                {group.id !== activeGroupId && (
                  <button onClick={() => onSetGroupActive(group.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded">
                    Set Active
                  </button>
                )}
                <button onClick={() => handleEditGroup(group)} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded">
                  Edit
                </button>
                <button onClick={() => onDeleteGroup(group.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};