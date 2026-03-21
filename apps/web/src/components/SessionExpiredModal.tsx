import Modal from './shared/Modal';
import Button from './shared/Button';

interface Props {
  isOpen: boolean;
}

export default function SessionExpiredModal({ isOpen }: Props) {
  const handleLogin = () => {
    window.location.href = '/login';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleLogin} title="Session Expired" size="sm">
      <div className="p-6 text-center space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Session Expired
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your session has expired. Please log in again to continue.
        </p>
        <Button onClick={handleLogin} className="w-full">
          Log In
        </Button>
      </div>
    </Modal>
  );
}
