import { Suspense } from "react";
import UserProfileClient from "./profile-client";

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B4DFF]" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading your profile...
            </p>
          </div>
        </div>
      }
    >
      <UserProfileClient />
    </Suspense>
  );
}
