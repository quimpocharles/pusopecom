import { XMarkIcon } from '@heroicons/react/24/outline';

const AnnouncementBar = ({ onDismiss }) => (
  <div className="fixed top-0 left-0 right-0 z-[60] h-8 bg-[#0a0a0a] text-white flex items-center justify-center px-10">
    <span className="text-xs font-medium tracking-wide">
      FREE shipping on orders ₱2,000 and above&nbsp;🇵🇭
    </span>
    <button
      onClick={onDismiss}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-60 transition-opacity"
      aria-label="Dismiss announcement"
    >
      <XMarkIcon className="w-3.5 h-3.5" />
    </button>
  </div>
);

export default AnnouncementBar;
