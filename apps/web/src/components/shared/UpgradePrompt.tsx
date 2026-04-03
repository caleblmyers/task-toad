interface UpgradePromptProps {
  feature: string;
  message: string;
}

export default function UpgradePrompt({ feature: _feature, message }: UpgradePromptProps) {
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-sm">
      <p className="text-indigo-700 dark:text-indigo-300">{message}</p>
      <a
        href="/settings?tab=billing"
        className="text-indigo-600 dark:text-indigo-400 underline text-xs mt-1 inline-block"
      >
        Upgrade to Pro
      </a>
    </div>
  );
}
