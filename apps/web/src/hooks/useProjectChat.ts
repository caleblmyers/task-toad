import { useState, useCallback } from 'react';
import { gql } from '../api/client';

interface ChatReference {
  type: string;
  id: string;
  title: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
  timestamp: Date;
}

interface ProjectChatResponse {
  answer: string;
  references: ChatReference[];
}

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

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, sendMessage, clearChat };
}
