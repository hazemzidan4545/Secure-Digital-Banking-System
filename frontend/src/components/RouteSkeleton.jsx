export default function RouteSkeleton() {
  return (
    <section className="pageWrap" aria-label="Loading page" aria-busy="true">
      <div className="skeletonLine short" />
      <div className="card skeletonCard">
        <div className="skeletonLine" />
        <div className="skeletonLine medium" />
        <div className="skeletonLine" />
        <div className="skeletonGrid">
          <div className="skeletonBlock" />
          <div className="skeletonBlock" />
          <div className="skeletonBlock" />
        </div>
        <div className="skeletonTable" />
      </div>
    </section>
  )
}
