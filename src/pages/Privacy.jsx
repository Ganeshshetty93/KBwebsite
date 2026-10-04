import PageHero from '../components/PageHero.jsx';

export default function Privacy() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Privacy Policy"
        text="Kannada Bharati collects only the information needed to support membership, classes, donations, volunteering, and community events."
      />

      <section className="section two-column">
        <div>
          <h2>How information is used</h2>
          <p>Member, family, registration, donation, and volunteer details are used for Kannada Bharati operations and communication.</p>
        </div>
        <div className="info-stack">
          <article>
            <h3>Account and profile</h3>
            <p>Profile details help us manage registrations, family members, class eligibility, and member communication.</p>
          </article>
          <article>
            <h3>Payments and donations</h3>
            <p>Donation and payment details are recorded for confirmation, reconciliation, and nonprofit reporting.</p>
          </article>
          <article>
            <h3>Sharing</h3>
            <p>We do not sell personal information. Access is limited to authorized volunteers and admins who support the organization.</p>
          </article>
        </div>
      </section>
    </>
  );
}
