import InfoPageShell from "@/components/InfoPageShell";

export default function SecurityPage() {
  return (
    <InfoPageShell title="Security">
      <p>
        Passwords are hashed before storage. Sessions use signed tokens that
        expire after 24 hours.
      </p>
      <p>
        Private arenas require admin approval before someone can join. Keep invite
        codes within your group if the arena is private.
      </p>
    </InfoPageShell>
  );
}
