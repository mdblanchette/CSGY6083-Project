"use client";
import "jsvectormap/dist/css/jsvectormap.css";
import "flatpickr/dist/flatpickr.min.css";
import "nouislider/dist/nouislider.css";
import "dropzone/dist/dropzone.css";
import "@/css/satoshi.css";
import "@/css/simple-datatables.css";
import "@/css/style.css";
import React, { useEffect, useState } from "react";
import Loader from "@/components/common/Loader";
import ToastContext from "./context/ToastContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  // const pathname = usePathname();

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  useEffect(() => {
    const touchPresence = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const res = await fetch("/api/user/presence", {
          method: "POST",
          cache: "no-store",
        });

        if (res.ok) {
          window.dispatchEvent(new Event("snickr-presence-updated"));
        }
      } catch {
        /* non-critical */
      }
    };

    void touchPresence();

    const intervalId = window.setInterval(() => {
      void touchPresence();
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void touchPresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <ToastContext />
        {loading ? <Loader /> : children}
      </body>
    </html>
  );
}
