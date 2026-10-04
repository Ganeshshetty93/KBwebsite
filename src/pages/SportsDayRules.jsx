import PageHero from '../components/PageHero.jsx';

const rules = [
  'Participants should check in before their scheduled event time.',
  'Age groups are based on the registration details submitted for each participant.',
  'A parent or guardian must remain available for children during the event.',
  'Event coordinators may combine, split, or adjust heats based on attendance and safety.',
  'Respect volunteers, judges, participants, and posted venue rules at all times.'
];

export default function SportsDayRules() {
  return (
    <>
      <PageHero
        eyebrow="Sports"
        title="Sports Day Rules"
        text="Guidelines for a fair, safe, and organized Kannada Bharati sports event."
      />

      <section className="section two-column">
        <div>
          <h2>Participant rules</h2>
          <p>Please review these rules before registering or checking in for sports day activities.</p>
        </div>
        <div className="info-stack">
          {rules.map((rule, index) => (
            <article key={rule}>
              <h3>Rule {index + 1}</h3>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
