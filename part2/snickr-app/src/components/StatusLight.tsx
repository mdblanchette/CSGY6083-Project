"use client";

import { useEffect, useState } from "react";

interface StatusLightProps {
  lastActive: string | null | undefined;
  statusEmoji?: string | null | undefined;
  statusText?: string | null | undefined;
  size?: "small" | "medium" | "large";
  className?: string;
}

const statusMeta: Record<
  string,
  { label: string; color: string; followsPresence: boolean }
> = {
  "🟢": { label: "Available", color: "bg-green", followsPresence: true },
  "🟡": { label: "Away", color: "bg-yellow-400", followsPresence: false },
  "🔴": { label: "Do Not Disturb", color: "bg-red", followsPresence: false },
  "⚫": { label: "Offline", color: "bg-gray-400", followsPresence: false },
};

const StatusLight = ({
  lastActive,
  statusEmoji,
  statusText,
  size = "small",
  className = "",
}: StatusLightProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeSinceMs = lastActive ? new Date(lastActive).getTime() : null;
  const isRecentActivity =
    activeSinceMs !== null &&
    Number.isFinite(activeSinceMs) &&
    Date.now() - activeSinceMs <= 2 * 60 * 1000;

  const manualStatus = statusEmoji ? statusMeta[statusEmoji] : undefined;
  const usesPresence = !manualStatus || manualStatus.followsPresence;
  const isOnline = usesPresence ? isRecentActivity : false;

  const colorClass = manualStatus
    ? manualStatus.followsPresence
      ? isOnline
        ? "bg-green"
        : "bg-gray-400"
      : manualStatus.color
    : isOnline
      ? "bg-green"
      : "bg-gray-400";

  const presenceLabel = isOnline
    ? "Active now"
    : activeSinceMs && Number.isFinite(activeSinceMs)
      ? `Last active ${new Date(activeSinceMs).toLocaleTimeString()}`
      : "No recent activity";

  const labelParts = [manualStatus?.label, statusText, presenceLabel].filter(
    Boolean,
  );
  const ariaLabel = labelParts.join(" · ");

  const sizeClasses = {
    small: "h-2 w-2",
    medium: "h-3 w-3",
    large: "h-4 w-4",
  };

  return (
    <div
      aria-label={ariaLabel}
      className={`inline-block rounded-full border border-white dark:border-gray-dark ${colorClass} ${sizeClasses[size]} ${className}`}
      title={ariaLabel}
    />
  );
};

export default StatusLight;
