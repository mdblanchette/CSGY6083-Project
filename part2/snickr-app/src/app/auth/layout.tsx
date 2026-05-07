import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(243,244,246,0.98)_45%,_rgba(226,232,240,1)_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.98),_rgba(17,24,39,0.98)_45%,_rgba(3,7,18,1)_100%)]">
      <div className="w-full max-w-xl rounded-[28px] border border-stroke bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-dark-3 dark:bg-gray-dark sm:p-10">
        {children}
      </div>
    </div>
  );
}
