import { useState, useRef, useEffect } from 'react';
import { useProjectChat } from '../hooks/useProjectChat';
import type { ChatAction, ChatMessage } from '../hooks/useProjectChat';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';

interface ProjectChatPanelProps {
  projectId: string;
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

function renderContentWithTaskLinks(
  msg: ChatMessage,
  onSelectTask?: (taskId: string) => void,
) {
  if (!onSelectTask || !msg.references || msg.references.length === 0) {
    return <p className="whitespace-pre-wrap">{msg.content}</p>;
  }

  const taskRefs = msg.references.filter((r) => r.type === 'task' && r.title);
  if (taskRefs.length === 0) {
    return <p className="whitespace-pre-wrap">{msg.content}</p>;
  }

  // Build a regex matching any task title in the content
  const escaped = taskRefs.map((r) => r.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  const titleToId = new Map(taskRefs.map((r) => [r.title, r.id]));

  const parts = msg.content.split(pattern);
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const taskId = titleToId.get(part);
        if (taskId) {
          return (
            <button
              key={i}
              onClick={() => onSelectTask(taskId)}
              className="text-violet-600 hover:text-violet-800 underline cursor-pointer font-medium"
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function ProjectChatPanel({ projectId, onClose, onSelectTask, addToast }: ProjectChatPanelProps) {
  const { messages, loading, sendMessage, applyAction, clearChat } = useProjectChat(projectId);
  const [input, setInput] = useState('');
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleApply = async (action: ChatAction, actionKey: string) => {
    const success = await applyAction(action);
    if (success) {
      setAppliedActions((prev) => new Set([...prev, actionKey]));
      addToast?.('success', action.label);
    } else {
      addToast?.('error', `Failed: ${action.label}`);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Project Chat" size="md">
      <div className="h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-800">Project Chat</h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-400">Ask a question about your project...</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-brand-green text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {renderContentWithTaskLinks(msg, onSelectTask)}
                {msg.references && msg.references.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.references.map((ref, j) => (
                      ref.type === 'task' && onSelectTask ? (
                        <button
                          key={j}
                          onClick={() => onSelectTask(ref.id)}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-violet-600 hover:bg-violet-100 cursor-pointer transition-colors"
                          title={`${ref.type}: ${ref.id}`}
                        >
                          <span className="font-medium">{ref.type}</span>
                          {ref.title}
                        </button>
                      ) : (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-slate-500"
                          title={`${ref.type}: ${ref.id}`}
                        >
                          <span className="font-medium">{ref.type}</span>
                          {ref.title}
                        </span>
                      )
                    ))}
                  </div>
                )}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {msg.suggestedActions.map((action, j) => {
                      const actionKey = `${msg.timestamp.getTime()}-${j}`;
                      const isApplied = appliedActions.has(actionKey);
                      return (
                        <button
                          key={j}
                          onClick={() => handleApply(action, actionKey)}
                          disabled={isApplied}
                          className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                            isApplied
                              ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                              : 'bg-white border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700'
                          }`}
                        >
                          <span className="flex-1">{action.label}</span>
                          {isApplied
                            ? <span className="text-green-600 text-xs">Applied</span>
                            : <span className="text-violet-600 text-xs font-medium">Apply</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-400">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Ask about tasks, sprints, progress..."
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-green"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-1.5 text-sm bg-brand-green text-white rounded-lg hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
