import { useState } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import { gql } from '../api/client';

interface OnboardingQuestion {
  question: string;
  context: string;
  category: string;
}

interface KnowledgeEntry {
  knowledgeEntryId: string;
  title: string;
  content: string;
  source: string;
  category: string;
}

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

type WizardStep = 'welcome' | 'questions' | 'review';

interface Answer {
  question: string;
  answer: string;
  category: string;
}

export default function OnboardingWizard({ isOpen, onClose, projectId }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleStartInterview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ generateOnboardingQuestions: OnboardingQuestion[] }>(
        `mutation($projectId: ID!) {
          generateOnboardingQuestions(projectId: $projectId) {
            question
            context
            category
          }
        }`,
        { projectId }
      );
      const qs = data.generateOnboardingQuestions;
      setQuestions(qs);
      setAnswers(qs.map((q) => ({ question: q.question, answer: '', category: q.category })));
      setCurrentIdx(0);
      setStep('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === currentIdx ? { ...a, answer: value } : a)));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setStep('review');
    }
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleSkip = () => {
    setAnswers((prev) => prev.map((a, i) => (i === currentIdx ? { ...a, answer: '' } : a)));
    handleNext();
  };

  const answeredEntries = answers.filter((a) => a.answer.trim() !== '');

  const handleSave = async () => {
    if (answeredEntries.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await gql<{ saveOnboardingAnswers: KnowledgeEntry[] }>(
        `mutation($projectId: ID!, $answers: [OnboardingAnswerInput!]!) {
          saveOnboardingAnswers(projectId: $projectId, answers: $answers) {
            knowledgeEntryId
            title
          }
        }`,
        { projectId, answers: answeredEntries }
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('welcome');
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setError(null);
    setDone(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Project Onboarding Interview" size="lg">
      <div className="p-6">
        {step === 'welcome' && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
              Help your AI understand your project better
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Answer a few questions about your project so TaskToad can generate more accurate tasks,
              code, and documentation tailored to your specific needs.
            </p>
            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                {error}
                <button
                  onClick={handleStartInterview}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}
            <Button onClick={handleStartInterview} disabled={loading}>
              {loading ? 'Generating questions...' : 'Start Interview'}
            </Button>
          </div>
        )}

        {step === 'questions' && questions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i === currentIdx
                        ? 'bg-violet-500'
                        : answers[i]?.answer.trim()
                          ? 'bg-violet-300 dark:bg-violet-600'
                          : 'bg-slate-200 dark:bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                {questions[currentIdx].question}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {questions[currentIdx].context}
              </p>
            </div>

            <textarea
              value={answers[currentIdx]?.answer ?? ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              rows={5}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-y"
              autoFocus
            />

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentIdx === 0}
              >
                Previous
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip}>
                  Skip
                </Button>
                <Button onClick={handleNext}>
                  {currentIdx === questions.length - 1 ? 'Review' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'review' && !done && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Review your answers
            </h2>
            {answeredEntries.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No questions were answered. Go back to answer at least one question.
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {answeredEntries.map((a, i) => (
                  <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.question}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{a.answer}</p>
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      {a.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                {error}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => { setStep('questions'); setCurrentIdx(0); }}>
                Back to Questions
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || answeredEntries.length === 0}
              >
                {saving ? 'Saving...' : `Save ${answeredEntries.length} Answer${answeredEntries.length !== 1 ? 's' : ''} to Knowledge Base`}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && done && (
          <div className="text-center space-y-4">
            <div className="text-3xl">&#10003;</div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Knowledge saved!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {answeredEntries.length} answer{answeredEntries.length !== 1 ? 's' : ''} saved to your project&apos;s knowledge base.
              TaskToad will use this context when generating tasks, code, and documentation.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
