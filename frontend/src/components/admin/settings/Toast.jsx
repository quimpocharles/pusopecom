import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-24 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
        isSuccess ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
      }`}
      role="status"
    >
      {isSuccess ? <CheckCircleIcon className="w-5 h-5 flex-shrink-0" /> : <XCircleIcon className="w-5 h-5 flex-shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
