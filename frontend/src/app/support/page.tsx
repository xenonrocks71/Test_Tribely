import InfoPageShell from "@/components/InfoPageShell";

export default function SupportPage() {
  return (
    <InfoPageShell title="Help">
      <p>
        If something isn&apos;t working with your account, an arena, or a proof
        submission, email{" "}
        <a
          href="mailto:support@tribely.app"
          className="text-[#5B4DFF] hover:text-[#4B3EEB]"
        >
          support@tribely.app
        </a>
        .
      </p>
      <p>
        Include your account email and the arena name. For ledger questions,
        mention the date and time of the submission you&apos;re asking about.
      </p>
    </InfoPageShell>
  );
}
