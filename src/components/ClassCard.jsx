import { CalendarDays, Clock, MapPin, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

function getClassImage(item) {
  if (item.photo) return item.photo;

  const title = item.title.toLowerCase();
  if (title.includes('guitar')) return '/assets/classes/guitar-class-photo.png';
  if (title.includes('sandalwood')) return '/assets/classes/sandalwood-dance-photo.png';
  if (title.includes('bharatanatya')) return '/assets/culture-feature/classical-dance-feature.png';
  if (title.includes('hindustani')) return '/assets/culture-feature/music-traditions-feature.png';
  if (title.includes('carnatic')) return '/assets/culture-feature/music-traditions-feature.png';
  if ((item.category || '').toLowerCase() === 'music') return '/assets/culture-feature/music-traditions-feature.png';
  if ((item.category || '').toLowerCase() === 'dance') return '/assets/culture-feature/classical-dance-feature.png';
  return '/assets/classes/kannada-language-class.png';
}

export default function ClassCard({ item }) {
  const classImage = getClassImage(item);

  return (
    <article className="class-card">
      <div className="class-card-media">
        <img className="card-photo" src={classImage} alt={`${item.title} class`} />
        <div className="class-card-media-copy">
          <span>{item.category || 'Language'}</span>
          <h3>{item.title}</h3>
        </div>
      </div>
      <div className="card-topline">
        <span className="pill">{item.category || 'Language'}</span>
        <span>{item.status || item.fee}</span>
      </div>
      <p>{item.focus || `${item.title} classes for Kannada Bharati families and community learners.`}</p>
      <ul className="icon-list">
        <li><CalendarDays size={17} /> {item.date || 'Sep 13, 2026 - Jun 20, 2027'}</li>
        <li><Clock size={17} /> {item.time}</li>
        <li><UserRound size={17} /> {item.age}</li>
        <li><MapPin size={17} /> {item.location || 'Virtual Google Classroom'}</li>
      </ul>
      <Link className="button compact" to={`/register?program=${encodeURIComponent(item.title)}`}>
        Register Interest
      </Link>
    </article>
  );
}
