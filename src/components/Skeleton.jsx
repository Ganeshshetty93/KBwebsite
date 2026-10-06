export default function Skeleton({ className = '', ...props }) {
  return <div className={`ui-skeleton${className ? ` ${className}` : ''}`} aria-hidden="true" {...props} />;
}
