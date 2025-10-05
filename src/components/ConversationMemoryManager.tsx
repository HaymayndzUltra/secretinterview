import React, { useMemo, useState } from 'react';
import { useKnowledgeBase, ConversationSummary, KnowledgeCategory } from '../contexts/KnowledgeBaseContext';
import { FaThumbtack, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';

interface ConversationMemoryManagerProps {
  className?: string;
}

const ConversationMemoryManager: React.FC<ConversationMemoryManagerProps> = ({ className = '' }) => {
  const {
    conversationSummaries,
    updateConversationSummary,
    deleteConversationSummary,
    clearConversationSummaries
  } = useKnowledgeBase();

  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPinned, setFilterPinned] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all');

  const sortedSummaries = useMemo(() => {
    return [...conversationSummaries].sort((a, b) => b.timestamp - a.timestamp);
  }, [conversationSummaries]);

  const filteredSummaries = sortedSummaries.filter(summary => {
    const matchesSearch = searchQuery === '' ||
      summary.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      summary.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPinned = !filterPinned || summary.pinned;

    const matchesCategory = selectedCategory === 'all' || summary.category === selectedCategory;

    return matchesSearch && matchesPinned && matchesCategory;
  });

  const handleExport = () => {
    if (filteredSummaries.length === 0) {
      return;
    }

    const payload = filteredSummaries.map(summary => ({
      id: summary.id,
      summary: summary.summary,
      tags: summary.tags,
      timestamp: summary.timestamp,
      pinned: summary.pinned,
      category: summary.category,
      context: summary.conversationContext,
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-summaries-${selectedCategory}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTogglePin = (id: string, pinned: boolean) => {
    updateConversationSummary(id, { pinned: !pinned });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this conversation summary?')) {
      deleteConversationSummary(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all conversation summaries? This action cannot be undone.')) {
      clearConversationSummaries();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className={`card bg-base-100 shadow-md ${className}`}>
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">
            Conversation Memory ({conversationSummaries.length})
          </h3>
          <div className="flex gap-2 flex-wrap justify-end">
            <select
              className="select select-bordered select-xs"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as KnowledgeCategory | 'all')}
            >
              <option value="all">ALL</option>
              {Object.values(KnowledgeCategory).map(category => (
                <option key={category} value={category}>
                  {category.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              className="btn btn-xs"
              disabled={filteredSummaries.length === 0}
            >
              Export
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn btn-sm btn-ghost"
            >
              {isExpanded ? <FaEyeSlash /> : <FaEye />}
              {isExpanded ? 'Hide' : 'Show'}
            </button>
            {conversationSummaries.length > 0 && (
              <button
                onClick={handleClearAll}
                className="btn btn-sm btn-error"
              >
                <FaTrash />
                Clear All
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Search and Filter Controls */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search summaries..."
                className="input input-bordered input-sm flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={filterPinned}
                  onChange={(e) => setFilterPinned(e.target.checked)}
                />
                <span className="text-sm">Pinned only</span>
              </label>
            </div>

            {/* Summaries List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredSummaries.length === 0 ? (
                <div className="text-center text-base-content/60 py-8">
                  {conversationSummaries.length === 0 
                    ? 'No conversation summaries yet. Summaries will be created automatically as you chat.'
                    : 'No summaries match your search criteria.'
                  }
                </div>
              ) : (
                filteredSummaries.map((summary) => (
                  <div
                    key={summary.id}
                    className={`border rounded-lg p-3 ${
                      summary.pinned ? 'border-primary bg-primary/5' : 'border-base-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-base-content/60">
                          {formatDate(summary.timestamp)}
                        </span>
                        <span className="badge badge-ghost badge-xs">
                          {summary.category.replace('_', ' ').toUpperCase()}
                        </span>
                        {summary.pinned && (
                          <span className="badge badge-primary badge-xs">Pinned</span>
                        )}
                      </div>
                        <p className="text-sm mb-2">{summary.summary}</p>
                        <div className="flex flex-wrap gap-1">
                          {summary.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="badge badge-outline badge-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleTogglePin(summary.id, summary.pinned)}
                          className={`btn btn-xs ${
                            summary.pinned ? 'btn-primary' : 'btn-ghost'
                          }`}
                          title={summary.pinned ? 'Unpin' : 'Pin'}
                        >
                          <FaThumbtack />
                        </button>
                        <button
                          onClick={() => handleDelete(summary.id)}
                          className="btn btn-xs btn-error"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    
                    {/* Conversation Context Preview */}
                    <details className="mt-2">
                      <summary className="text-xs text-base-content/60 cursor-pointer">
                        View conversation context
                      </summary>
                      <div className="mt-2 text-xs space-y-1">
                        <div>
                          <strong>User:</strong> {summary.conversationContext.userMessage.substring(0, 100)}
                          {summary.conversationContext.userMessage.length > 100 && '...'}
                        </div>
                        <div>
                          <strong>Assistant:</strong> {summary.conversationContext.assistantResponse.substring(0, 100)}
                          {summary.conversationContext.assistantResponse.length > 100 && '...'}
                        </div>
                      </div>
                    </details>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConversationMemoryManager;
