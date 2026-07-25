import InfoPageShell from "@/components/InfoPageShell";

export default function SupportPage() {
  return (
    <InfoPageShell
      title="Help & Support"
      subtitle="We're here if something goes wrong."
      icon="🛟"
    >
      <p>
        If something isn&apos;t working with your account, an arena, or a proof
        submission, reach out directly via email:
      </p>
      <a
        href="mailto:support@tribely.app"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition hover:opacity-80"
        style={{
          background: "var(--accent-light)",
          color: "var(--accent)",
          border: "1px solid rgba(0,122,204,0.25)",
        }}
      >
        ✉️ support@tribely.app
      </a>
      <p>
        Include your account email and the arena name in your message. For
        ledger questions, mention the date and time of the submission
        you&apos;re asking about so we can locate it quickly.
      </p>
      <ul className="space-y-3 mt-2">
        {[
          "Average response time: under 24 hours on weekdays.",
          "For urgent arena disputes, include the arena invite code.",
          "Bug reports are always welcome — include steps to reproduce.",
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
