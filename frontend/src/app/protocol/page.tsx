import InfoPageShell from "@/components/InfoPageShell";

export default function ProtocolPage() {
  return (
    <InfoPageShell
      title="How Tribely Works"
      subtitle="The complete accountability loop — join, prove, or pay."
      icon="⚡"
    >
      <p>
        Tribely runs on a simple, enforced loop: join an arena, post proof
        before the daily cutoff, and pay the agreed penalty if you miss.
      </p>
      <ul className="space-y-3 mt-2">
        {[
          "Each arena sets its own daily deadline and penalty amount.",
          "You can submit one proof per active window — no late entries.",
          "Proof can be an image upload, a URL link, or a short text note.",
          "Missed deadlines are permanently recorded in the arena ledger.",
          "Peer members upvote or downvote each proof to verify authenticity.",
          "A proof with downvotes exceeding half the member count is disqualified.",
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
