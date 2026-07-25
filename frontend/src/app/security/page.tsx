import InfoPageShell from "@/components/InfoPageShell";

export default function SecurityPage() {
  return (
    <InfoPageShell
      title="Security & Privacy"
      subtitle="How Tribely protects your account and arena data."
      icon="🔒"
    >
      <p>
        Passwords are hashed using industry-standard bcrypt before storage —
        we never store plaintext credentials. Sessions are managed via signed
        JWT tokens that automatically expire after 24 hours.
      </p>
      <p>
        Private arenas require explicit admin approval before anyone can join.
        Keep your arena invite codes within your trusted group — codes provide
        direct access to the join request flow.
      </p>
      <ul className="space-y-3 mt-2">
        {[
          "All API communication is encrypted over HTTPS.",
          "WebSocket arena connections are token-authenticated.",
          "Account deletion permanently removes all profile data and activity.",
          "No payment data is stored — penalty tracking is social only.",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "var(--success)", marginTop: "6px" }}
            />
            {item}
          </li>
        ))}
      </ul>
    </InfoPageShell>
  );
}
