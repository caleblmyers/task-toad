import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/context';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateOrg from './pages/CreateOrg';
import AppLayout from './pages/AppLayout';
import Home from './pages/Home';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';

// Lazy-load heavy route components for code-splitting
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const OrgSettings = lazy(() => import('./pages/OrgSettings'));
const Search = lazy(() => import('./pages/Search'));
const NewProject = lazy(() => import('./pages/NewProject'));
const Projects = lazy(() => import('./pages/Projects'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.orgId) return <Navigate to="/create-org" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route
            path="/create-org"
            element={
              <ProtectedOrCreateOrg>
                <CreateOrg />
              </ProtectedOrCreateOrg>
            }
          />
          <Route
            path="/app"
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<Home />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<NewProject />} />
            <Route path="projects/:projectId" element={<ProjectDetail />} />
            <Route path="search" element={<Search />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<OrgSettings />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedOrCreateOrg({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.orgId) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
