import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/context';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateOrg from './pages/CreateOrg';
import AppLayout from './pages/AppLayout';
import Home from './pages/Home';
import NewProject from './pages/NewProject';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import OrgSettings from './pages/OrgSettings';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import Search from './pages/Search';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.orgId) return <Navigate to="/create-org" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
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
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="search" element={<Search />} />
        <Route path="settings" element={<OrgSettings />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

function ProtectedOrCreateOrg({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.orgId) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
