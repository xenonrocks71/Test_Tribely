import { Suspense } from "react";
import UserProfileClient from "./profile-client";

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F3F4F6] text-slate-500 flex items-center justify-center text-sm">
          Loading...
        </div>
      }
    >
      <UserProfileClient />
    </Suspense>
  );
}
