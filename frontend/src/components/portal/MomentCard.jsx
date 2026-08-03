import { Link } from 'react-router-dom';
import { Panel, Badge } from '../ui';

// One component for every Home feed moment, varied by `type` — not five
// hand-built card layouts. Each moment already carries a { title, body,
// image, link, timestamp } shape from GET /api/account/home (see
// accountRepository.getHomeFeed) — this only adds the per-type label/tone.
const TYPE_CONFIG = {
  order: { label: 'Order', tone: 'primary' },
  'fit-check': { label: 'Fit Check', tone: 'accent' },
  following: { label: 'Following', tone: 'secondary' },
  locker: { label: 'On Sale', tone: 'success' },
  notification: { label: 'Notification', tone: 'primary' },
  trending: { label: 'Trending', tone: 'secondary' },
};

const MomentCard = ({ moment }) => {
  const config = TYPE_CONFIG[moment.type] || { label: moment.type, tone: 'primary' };
  const isExternalLike = moment.link && !moment.link.startsWith('/');

  const content = (
    <Panel padding="p-4" className="flex gap-4 items-center hover:border-primary-300 transition-colors">
      {moment.image && (
        <img src={moment.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <Badge tone={config.tone} className="mb-1.5">{config.label}</Badge>
        <p className="font-semibold text-gray-900 text-sm truncate">{moment.title}</p>
        <p className="text-sm text-gray-500 truncate">{moment.body}</p>
      </div>
    </Panel>
  );

  if (!moment.link) return content;
  if (isExternalLike) {
    return <a href={moment.link} className="block">{content}</a>;
  }
  return <Link to={moment.link} className="block">{content}</Link>;
};

export default MomentCard;
