import { useState, useCallback } from 'react';
import { gql } from '../api/client';

interface ChatReference {
  type: string;
  id: string;
  title: string;
}

export interface ChatAction {
  type: string;
  label: string;
  data: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
  suggestedActions?: ChatAction[];
  timestamp: Date;
}

interface ProjectChatResponse {
  answer: string;
  references: ChatReference[];
  suggestedActions: ChatAction[];
}

const APPLY_CHAT_ACTION_MUTATION = `
  mutation ApplyChatAction($projectId: ID!, $action: ChatActionInput!) {
    applyChatAction(projectId: $projectId, action: $action) {
      success message taskId
    }
  }
`;

export function useProjectChat(projectId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (question: string) => {
    if (!projectId || !question.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: question, timestamp: new Date() }]);
    setLoading(true);

    try {
      const data = await gql<{ projectChat: ProjectChatResponse }>(
        `query ProjectChat($projectId: ID!, $question: String!) {
          projectChat(projectId: $projectId, question: $question) {
            answer
            references { type id title }
            suggestedActions { type label data }
          }
        }`,
        { projectId, question }
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.projectChat.answer,
          references: data.projectChat.references,
          suggestedActions: data.projectChat.suggestedActions,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Failed to get response',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const applyAction = useCallback(async (action: ChatAction): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const result = await gql<{ applyChatAction: { success: boolean; message: string; taskId?: string } }>(
        APPLY_CHAT_ACTION_MUTATION,
        { projectId, action: { type: action.type, data: action.data } }
      );
      return result.applyChatAction.success;
    } catch {
      return false;
    }
  }, [projectId]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, sendMessage, applyAction, clearChat };
}
