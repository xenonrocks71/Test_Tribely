import Link from "next/link";
import TribelyLogo from "@/components/TribelyLogo";

interface InfoPageShellProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoPageShell({ title, children }: InfoPageShellProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2.5">
          <TribelyLogo className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="text-base font-bold text-slate-950 dark:text-white">Tribely</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-semibold text-[#5B4DFF] hover:text-[#4B3EEB] transition-colors"
        >
          Sign in
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
        <div className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
          {children}
        </div>
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-[#5B4DFF] hover:text-[#4B3EEB] transition-colors pt-2"
        >
          ← Back home
        </Link>
      </main>
    </div>
  );
}
