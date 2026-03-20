import { useState } from 'react';
import type { Release } from '../types';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface ReleaseModalProps {
  initialRelease?: Release;
  onSubmit: (data: { name: string; version: string; description?: string; releaseDate?: string }) => Promise<void>;
  onClose: () => void;
}

export default function ReleaseModal({ initialRelease, onSubmit, onClose }: ReleaseModalProps) {
  const isEdit = !!initialRelease;
  const [name, setName] = useState(initialRelease?.name ?? '');
  const [version, setVersion] = useState(initialRelease?.version ?? '');
  const [description, setDescription] = useState(initialRelease?.description ?? '');
  const [releaseDate, setReleaseDate] = useState(initialRelease?.releaseDate ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !version.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      await onSubmit({
        name: name.trim(),
        version: version.trim(),
        description: description.trim() || undefined,
        releaseDate: releaseDate || undefined,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save release');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Release' : 'New Release'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{isEdit ? 'Edit Release' : 'New Release'}</h2>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            placeholder="e.g. Sprint 5 Release"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Version *</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            placeholder="e.g. 1.2.0"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            rows={3}
            placeholder="What's in this release?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Release Date</label>
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!name.trim() || !version.trim()}>
            {isEdit ? 'Save' : 'Create Release'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
