import Skeleton from './Skeleton.jsx';
import Spinner from './Spinner.jsx';

export default function PageLoader({ active = false, label = 'Loading Kannada Bharati' }) {
  return (
    <div className={active ? 'page-loader is-active' : 'page-loader'} role="status" aria-live="polite" aria-hidden={!active}>
      <div className="loader-card">
        <div className="loader-heading">
          <div className="loader-emblem" aria-hidden="true">
            <span>ಕ</span>
          </div>
          <div className="loader-copy">
            <div className="loader-title">
              <Spinner size={18} label={label} />
              <strong>{label}</strong>
            </div>
            <p>Preparing classes, events, and community details</p>
          </div>
        </div>
        <div className="loader-skeletons" aria-hidden="true">
          <Skeleton className="loader-skeleton-wide" />
          <Skeleton className="loader-skeleton-medium" />
          <Skeleton className="loader-skeleton-short" />
        </div>
        <div className="loader-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
