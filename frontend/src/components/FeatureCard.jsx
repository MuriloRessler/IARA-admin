export function FeatureCard({ icon, title, description }) {
  return (
    <article className="feature-card">
      <span className="feature-card__icon" aria-hidden="true">{icon}</span>
      <div>
        <div className="feature-card__heading">
          <h3>{title}</h3>
          <span className="feature-card__badge">Em desenvolvimento</span>
        </div>
        <p>{description}</p>
      </div>
    </article>
  );
}
