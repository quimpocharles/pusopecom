import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeftIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import helpService from '../../services/helpService';
import { recordArticleVisit } from '../../utils/helpReadHistory';

function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p className="text-sm text-gray-700 leading-relaxed">{block.text}</p>;
    case 'steps':
      return (
        <ol className="list-decimal list-outside ml-5 space-y-1.5 text-sm text-gray-700">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      );
    case 'list':
      return (
        <ul className="list-disc list-outside ml-5 space-y-1.5 text-sm text-gray-700">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case 'note':
      return (
        <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{block.text}</p>
        </div>
      );
    case 'warning':
      return (
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{block.text}</p>
        </div>
      );
    case 'image':
      // Per backend/data/helpCenterContent.js's own contract: render nothing
      // (never a broken image or a fake placeholder) until a real screenshot
      // has been extracted and src is set.
      if (!block.src) return null;
      return (
        <figure>
          <img src={block.src} alt={block.alt} className="rounded-lg border border-gray-200 w-full" />
          {block.caption && <figcaption className="text-xs text-gray-500 mt-1.5">{block.caption}</figcaption>}
        </figure>
      );
    default:
      return null;
  }
}

/**
 * Single help article view. Gated only by AdminRoute, same as the index —
 * see AdminHelpCenter.jsx.
 */
const AdminHelpArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setArticle(null);
    helpService.getArticle(slug)
      .then((res) => {
        setArticle(res.data);
        // Record the visit only once the article is confirmed to actually
        // exist — a 404 shouldn't count as "read." Re-opening the same
        // article (e.g. a refresh) is expected to update the timestamp.
        recordArticleVisit(slug);
      })
      .catch((err) => {
        if (err.response?.status === 404) setError('This article could not be found.');
        else setError('Failed to load this article.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/admin/help" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Help Center
      </Link>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {article && (
        <article>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{article.title}</h1>
          <p className="text-sm text-gray-600 mb-6">{article.summary}</p>

          {article.correction && (
            <div className="flex gap-2 p-3 mb-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p><span className="font-semibold">Corrected from the written training guide:</span> {article.correction}</p>
            </div>
          )}

          <div className="space-y-4">
            {article.body.map((block, i) => <Block key={i} block={block} />)}
          </div>

          <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
            Source: {article.sourceRef}
            {article.verified ? ' — verified against the live implementation.' : ' — reflects the source training guide as written.'}
          </p>
        </article>
      )}
    </div>
  );
};

export default AdminHelpArticle;
