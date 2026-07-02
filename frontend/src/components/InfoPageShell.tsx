import Link from "next/link";
import TribelyLogo from "@/components/TribelyLogo";

interface InfoPageShellProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoPageShell({ title, children }: InfoPageShellProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2.5">
          <TribelyLogo className="h-8 w-8" />
          <span className="text-base font-bold text-slate-950">Tribely</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-semibold text-[#5B4DFF] hover:text-[#4B3EEB] transition-colors"
        >
          Sign in
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        <div className="text-base text-slate-600 leading-relaxed space-y-4">
          {children}
        </div>
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-[#5B4DFF] hover:text-[#4B3EEB] transition-colors"
        >
          ← Back home
        </Link>
      </main>
    </div>
  );
}
