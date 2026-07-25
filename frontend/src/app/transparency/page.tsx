import InfoPageShell from "@/components/InfoPageShell";

export default function TransparencyPage() {
  return (
    <InfoPageShell
      title="Ledger & Transparency"
      subtitle="Every action in an arena is logged, visible, and immutable."
      icon="📋"
    >
      <p>
        Every proof submission and missed deadline in an arena is permanently
        logged in the live ledger. Members can scroll the full history, verify
        each submission, and see who maintained their streak.
      </p>
      <p>
        There are no hidden adjustments — what the group sees in the ledger is
        exactly what happened. Votes are counted and displayed in real time.
      </p>
      <ul className="space-y-3 mt-2">
        {[
          "All proof submissions are timestamped at the moment of upload.",
          "Peer upvotes and downvotes are recorded per submission.",
          "Proofs disqualified by majority downvote are clearly marked.",
          "Missed windows are logged as absent — no retroactive edits allowed.",
          "Arena admins cannot alter or delete member submissions.",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "var(--accent)", marginTop: "6px" }}
            />
            {item}
          </li>
        ))}
      </ul>
    </InfoPageShell>
  );
}
