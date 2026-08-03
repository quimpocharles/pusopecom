import { XMarkIcon } from '@heroicons/react/24/outline';

// message: the highest-priority active PromoMessage for placement=announcement
// (pinned first, then displayOrder) — fetched and schedule-filtered by
// Layout.jsx, which also decides whether to render this at all.
const AnnouncementBar = ({ message, onDismiss }) => (
  <div className="fixed top-0 left-0 right-0 z-[60] h-8 bg-[#0a0a0a] text-white flex items-center justify-center px-10">
    <span className="text-xs font-medium tracking-wide">
      {message.link ? (
        <a href={message.link} className="hover:underline">{message.text}</a>
      ) : (
        message.text
      )}
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
