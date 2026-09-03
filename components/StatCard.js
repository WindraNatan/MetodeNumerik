export default function StatCard({ label, value, unit, icon, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__content">
        <span className="stat-card__value">
          {value}
          <small>{unit}</small>
        </span>
        <span className="stat-card__label">{label}</span>
      </div>
    </div>
  );
}
