export default function PageLoader({ active = false, label = 'Loading Kannada Bharati' }) {
  return (
    <div className={active ? 'page-loader is-active' : 'page-loader'} role="status" aria-live="polite" aria-hidden={!active}>
      <div className="loader-card">
        <div className="loader-emblem" aria-hidden="true">
          <span>ಕ</span>
        </div>
        <div>
          <strong>{label}</strong>
          <p>Preparing classes, events, and community details</p>
        </div>
        <div className="loader-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
