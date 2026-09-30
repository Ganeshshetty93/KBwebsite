import PageHero from '../components/PageHero.jsx';

export default function WebRequirements() {
  return (
    <>
      <PageHero
        eyebrow="Website"
        title="Web Requirements"
        text="Recommended browser and device settings for using Kannada Bharati registration, donation, and member pages."
      />

      <section className="section two-column">
        <div>
          <h2>Recommended setup</h2>
          <p>For the smoothest experience, use a current browser and allow popups for payment and sign-in flows.</p>
        </div>
        <div className="info-stack">
          <article>
            <h3>Browsers</h3>
            <p>Use the latest Chrome, Edge, Safari, or Firefox on desktop or mobile.</p>
          </article>
          <article>
            <h3>Payments and login</h3>
            <p>Enable cookies and popups for Google sign-in and PayPal payment windows.</p>
          </article>
          <article>
            <h3>Uploads</h3>
            <p>Profile and event images should be jpg, jpeg, png, or webp files under 8 MB.</p>
          </article>
        </div>
      </section>
    </>
  );
}
