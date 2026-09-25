export default function Loading() {
  return (
    <div className="route-skeleton" role="status" aria-busy="true">
      <div className="route-skeleton-bar" />
      <div className="route-skeleton-body">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-sub" />
        <div className="skeleton-cards">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}
