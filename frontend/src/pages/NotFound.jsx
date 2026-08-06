import { Link } from 'react-router-dom';

// A catch-all for any unmatched URL, app-wide — added after discovering
// the app had none: with React Router v6, a nested route tree with no
// matching leaf doesn't render the parent with an empty slot, it fails to
// match at all, and with no wildcard route anywhere, <Routes> rendered
// nothing — a fully blank page for any typo'd or not-yet-built URL, not
// just inside /admin/reports.
const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
    <p className="text-6xl font-bold text-gray-200">404</p>
    <p className="text-lg text-gray-500 mt-2 mb-6">This page doesn't exist.</p>
    <Link to="/" className="btn-primary">Back to Home</Link>
  </div>
);

export default NotFound;
