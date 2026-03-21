import { useState } from 'react';
import type { OrgUser } from '../types';
import Modal from './shared/Modal';
import MembersTab from './settings/MembersTab';
import AutomationTab from './settings/AutomationTab';
import CustomFieldsTab from './settings/CustomFieldsTab';
import TemplatesTab from './settings/TemplatesTab';
import WorkflowTab from './settings/WorkflowTab';
import FieldPermissionsTab from './settings/FieldPermissionsTab';
import SLATab from './settings/SLATab';

interface Props {
  projectId: string;
  orgUsers: OrgUser[];
  onClose: () => void;
}

type Tab = 'members' | 'automation' | 'fields' | 'templates' | 'workflow' | 'permissions' | 'sla';

const TABS: { key: Tab; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'automation', label: 'Automation' },
  { key: 'fields', label: 'Custom Fields' },
  { key: 'templates', label: 'Templates' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'permissions', label: 'Field Permissions' },
  { key: 'sla', label: 'SLA' },
];

export default function ProjectSettingsModal({ projectId, orgUsers, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('members');

  return (
    <Modal isOpen={true} onClose={onClose} title="Project Settings" size="md">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Project Settings</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none" aria-label="Close">&times;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-600 px-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'members' && <MembersTab projectId={projectId} orgUsers={orgUsers} />}
        {tab === 'automation' && <AutomationTab projectId={projectId} orgUsers={orgUsers} />}
        {tab === 'fields' && <CustomFieldsTab projectId={projectId} />}
        {tab === 'templates' && <TemplatesTab projectId={projectId} />}
        {tab === 'workflow' && <WorkflowTab projectId={projectId} />}
        {tab === 'permissions' && <FieldPermissionsTab projectId={projectId} />}
        {tab === 'sla' && <SLATab projectId={projectId} />}
      </div>
    </Modal>
  );
}
