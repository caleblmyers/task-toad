import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Intelligent Decomposition',
    description: 'Describe your goal in plain language. TaskToad breaks it into epics, tasks, and subtasks with a dependency graph — ready to execute.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    title: 'Context Threading',
    description: 'Each task inherits context from completed upstream work. Task #5 succeeds because tasks #1–4 informed it.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: 'Orchestration Loop',
    description: 'TaskToad monitors execution, handles failures, and re-plans when things change. Code generation, PR creation, review, and merge — fully automated.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
];

const steps = [
  { number: '1', title: 'Describe your project', description: 'Tell TaskToad what you want to build in plain language.' },
  { number: '2', title: 'Review the plan', description: 'TaskToad decomposes your goal into a dependency-aware task graph.' },
  { number: '3', title: 'Hit autopilot', description: 'Tasks execute in order — code generation, PRs, reviews, and merges.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="TaskToad" className="w-8 h-8" />
            <span className="font-semibold text-lg text-slate-900 dark:text-white">TaskToad</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-green hover:bg-brand-green-hover text-white transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            Autopilot for software projects
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Describe what you want to build. TaskToad decomposes it into tasks, generates code, creates PRs, and merges them — all without you managing each step.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-6 py-3 rounded-lg bg-brand-green hover:bg-brand-green-hover text-white font-semibold text-base transition-colors"
            >
              Start building
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-base transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-10 h-10 rounded-full bg-brand-green text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-12">
            Three pillars of the autopilot
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Stop managing tasks. Start shipping.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Free tier includes AI-powered planning and single-agent execution. Upgrade for the full autopilot pipeline.
          </p>
          <Link
            to="/signup"
            className="inline-block px-6 py-3 rounded-lg bg-brand-green hover:bg-brand-green-hover text-white font-semibold transition-colors"
          >
            Get started for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <img src="/logo.png" alt="TaskToad" className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} TaskToad</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
