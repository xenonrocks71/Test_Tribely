import InfoPageShell from "@/components/InfoPageShell";

export default function ProtocolPage() {
  return (
    <InfoPageShell title="How it works">
      <p>
        Tribely runs on a simple loop: join an arena, post proof before the
        daily cutoff, and pay the penalty if you miss.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Each arena sets its own deadline and penalty amount.</li>
        <li>You can submit one proof per deadline window.</li>
        <li>Proof can be an image, a link, or a short text note.</li>
        <li>Missed deadlines are recorded in the arena ledger.</li>
      </ul>
    </InfoPageShell>
  );
}
