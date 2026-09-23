import { Link } from 'react-router-dom';

export default function PageHero({ eyebrow, title, text, actions = [], image = false, className = '' }) {
  const heroClass = `${image ? 'page-hero image-hero' : 'page-hero'} ${className}`.trim();

  return (
    <section className={heroClass}>
      <div className="page-hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {actions.length > 0 && (
          <div className="hero-actions">
            {actions.map((action) => (
              <Link key={action.href} className={`button ${action.variant || 'primary'}`} to={action.href}>
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
