import { useState, useCallback, useEffect } from 'react';
import Modal from './shared/Modal';
import { gql } from '../api/client';

interface KnowledgeEntry {
  knowledgeEntryId: string;
  projectId: string;
  title: string;
  content: string;
  source: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

type Category = 'standard' | 'pattern' | 'business' | 'integration';

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'standard', label: 'Standard', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'pattern', label: 'Pattern', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'business', label: 'Business', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'integration', label: 'Integration', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
];

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  upload: { label: 'Upload', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  onboarding: { label: 'Onboarding', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  learned: { label: 'Learned', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
};

const KNOWLEDGE_ENTRIES_QUERY = `query KnowledgeEntries($projectId: ID!) {
  knowledgeEntries(projectId: $projectId) {
    knowledgeEntryId projectId title content source category createdAt updatedAt
  }
}`;

const CREATE_KNOWLEDGE_ENTRY_MUTATION = `mutation CreateKnowledgeEntry($projectId: ID!, $title: String!, $content: String!, $source: String, $category: String) {
  createKnowledgeEntry(projectId: $projectId, title: $title, content: $content, source: $source, category: $category) {
    knowledgeEntryId projectId title content source category createdAt updatedAt
  }
}`;

const UPDATE_KNOWLEDGE_ENTRY_MUTATION = `mutation UpdateKnowledgeEntry($knowledgeEntryId: ID!, $title: String, $content: String, $category: String) {
  updateKnowledgeEntry(knowledgeEntryId: $knowledgeEntryId, title: $title, content: $content, category: $category) {
    knowledgeEntryId projectId title content source category createdAt updatedAt
  }
}`;

const DELETE_KNOWLEDGE_ENTRY_MUTATION = `mutation DeleteKnowledgeEntry($knowledgeEntryId: ID!) {
  deleteKnowledgeEntry(knowledgeEntryId: $knowledgeEntryId)
}`;

interface KnowledgeBasePanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** Legacy project.knowledgeBase text for migration banner */
  knowledgeBase?: string | null;
  onRefreshFromRepo?: () => Promise<void>;
  hasGitHubRepo?: boolean;
  onRunInterview?: () => void;
}

export default function KnowledgeBasePanel({
  isOpen,
  onClose,
  projectId,
  knowledgeBase,
  onRefreshFromRepo,
  hasGitHubRepo,
  onRunInterview,
}: KnowledgeBasePanelProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('standard');
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ knowledgeEntries: KnowledgeEntry[] }>(
        KNOWLEDGE_ENTRIES_QUERY,
        { projectId }
      );
      setEntries(data.knowledgeEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) fetchEntries();
  }, [isOpen, fetchEntries]);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('standard');
    setEditingEntry(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (entry: KnowledgeEntry) => {
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormCategory(entry.category as Category);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const nameWithoutExt = file.name.replace(/\.(txt|md)$/, '');
      setFormTitle(nameWithoutExt);
      setFormContent(text);
      setShowForm(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingEntry) {
        const data = await gql<{ updateKnowledgeEntry: KnowledgeEntry }>(
          UPDATE_KNOWLEDGE_ENTRY_MUTATION,
          {
            knowledgeEntryId: editingEntry.knowledgeEntryId,
            title: formTitle.trim(),
            content: formContent,
            category: formCategory,
          }
        );
        setEntries((prev) =>
          prev.map((e) =>
            e.knowledgeEntryId === editingEntry.knowledgeEntryId
              ? data.updateKnowledgeEntry
              : e
          )
        );
      } else {
        const data = await gql<{ createKnowledgeEntry: KnowledgeEntry }>(
          CREATE_KNOWLEDGE_ENTRY_MUTATION,
          {
            projectId,
            title: formTitle.trim(),
            content: formContent,
            source: 'upload',
            category: formCategory,
          }
        );
        setEntries((prev) => [data.createKnowledgeEntry, ...prev]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (knowledgeEntryId: string) => {
    setError(null);
    try {
      await gql<{ deleteKnowledgeEntry: boolean }>(
        DELETE_KNOWLEDGE_ENTRY_MUTATION,
        { knowledgeEntryId }
      );
      setEntries((prev) => prev.filter((e) => e.knowledgeEntryId !== knowledgeEntryId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshFromRepo) return;
    setRefreshing(true);
    try {
      await onRefreshFromRepo();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMigrate = async () => {
    if (!knowledgeBase) return;
    setMigrating(true);
    setError(null);
    try {
      const data = await gql<{ createKnowledgeEntry: KnowledgeEntry }>(
        CREATE_KNOWLEDGE_ENTRY_MUTATION,
        {
          projectId,
          title: 'Project Knowledge Base (migrated)',
          content: knowledgeBase,
          source: 'upload',
          category: 'standard',
        }
      );
      setEntries((prev) => [data.createKnowledgeEntry, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to migrate knowledge base');
    } finally {
      setMigrating(false);
    }
  };

  // Show migration banner when legacy KB has content and no matching migrated entry exists
  const showMigrationBanner =
    !!knowledgeBase?.trim() &&
    !loading &&
    !entries.some((e) => e.title === 'Project Knowledge Base (migrated)');

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    if (!cat) return null;
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${cat.color}`}>
        {cat.label}
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    const badge = SOURCE_BADGES[source];
    if (!badge) return null;
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Knowledge Base" size="lg">
      <div className="p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Knowledge Base
          </h2>
          <div className="flex items-center gap-2">
            {hasGitHubRepo && onRefreshFromRepo && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing…' : 'Refresh from repo'}
              </button>
            )}
            {onRunInterview && (
              <button
                onClick={onRunInterview}
                className="px-3 py-1.5 text-xs text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30"
              >
                Run Interview
              </button>
            )}
            <label className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
              Upload file
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={openCreateForm}
              className="px-3 py-1.5 text-xs text-white bg-slate-700 dark:bg-slate-600 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500"
            >
              + Add Entry
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Knowledge entries are injected into AI prompts to give context about your project.
        </p>

        {error && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Legacy migration banner */}
        {showMigrationBanner && (
          <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Migrate legacy knowledge base
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Your project has a legacy text-based knowledge base. Migrate it to a structured entry.
              </p>
            </div>
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 shrink-0"
            >
              {migrating ? 'Migrating…' : 'Migrate'}
            </button>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="mb-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              {editingEntry ? 'Edit Entry' : 'New Entry'}
            </h3>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Content — describe tech stack, conventions, architecture, etc."
              rows={6}
              className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green resize-y"
            />
            <div className="flex items-center justify-between">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as Category)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-green"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formTitle.trim() || !formContent.trim()}
                  className="px-3 py-1.5 text-xs text-white bg-slate-700 dark:bg-slate-600 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingEntry ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-40">&#128218;</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              No knowledge entries yet
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Add entries to give your AI better context about this project.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.knowledgeEntryId}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                        {entry.title}
                      </span>
                      {getCategoryBadge(entry.category)}
                      {getSourceBadge(entry.source)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditForm(entry)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirm === entry.knowledgeEntryId ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(entry.knowledgeEntryId)}
                          className="px-2 py-0.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-0.5 text-xs text-slate-500 border border-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(entry.knowledgeEntryId)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
