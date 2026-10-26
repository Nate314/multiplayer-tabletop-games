const SHOWN = 12;

// The most recent events, newest first, so everyone can follow placements, battles and trades
export default function EventLog({ log }: { log: string[] }) {
  if (log.length === 0) return null;
  return (
    <section className="panel event-log hand-only-hide" aria-label="Recent events">
      <div className="panel-title">Recent events</div>
      <ol>
        {log.slice(-SHOWN).reverse().map((event, index) => <li key={`${log.length}-${index}`}>{event}</li>)}
      </ol>
    </section>
  );
}
