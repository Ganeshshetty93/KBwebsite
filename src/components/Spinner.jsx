import { LoaderCircle } from 'lucide-react';

export default function Spinner({ className = '', label = 'Loading', ...props }) {
  return (
    <LoaderCircle
      className={`ui-spinner${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={label}
      {...props}
    />
  );
}
