import { useState, useRef, useEffect } from 'react';
import { useProjectChat } from '../hooks/useProjectChat';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';

interface ProjectChatPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function ProjectChatPanel({ projectId, onClose }: ProjectChatPanelProps) {
  const { messages, loading, sendMessage, clearChat } = useProjectChat(projectId);
  const [input, setInput] = useState('');
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
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.references && msg.references.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.references.map((ref, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-slate-500"
                        title={`${ref.type}: ${ref.id}`}
                      >
                        <span className="font-medium">{ref.type}</span>
                        {ref.title}
                      </span>
                    ))}
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
