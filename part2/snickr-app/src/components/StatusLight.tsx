"use client";

interface StatusLightProps {
  lastActive: string | null | undefined;
  size?: "small" | "medium" | "large";
  className?: string;
}

/**
 * StatusLight component displays user online/offline status
 * Green: User is online (last active within 2 minutes)
 * Grey: User is offline (last active >2 minutes ago)
 */
const StatusLight = ({
  lastActive,
  size = "small",
  className = "",
}: StatusLightProps) => {
  const isOnline = (() => {
    if (!lastActive) return false;

    const lastActiveTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    const diffMs = now - lastActiveTime;
    const diffMinutes = diffMs / (1000 * 60);

    return diffMinutes <= 2;
  })();

  const sizeClasses = {
    small: "h-2 w-2",
    medium: "h-3 w-3",
    large: "h-4 w-4",
  };

  return (
    <div
      className={`inline-block rounded-full border border-white dark:border-gray-dark ${
        isOnline ? "bg-green" : "bg-gray-400"
      } ${sizeClasses[size]} ${className}`}
      title={
        isOnline
          ? "Online"
          : `Last active ${lastActive ? new Date(lastActive).toLocaleTimeString() : "unknown"}`
      }
    />
  );
};

export default StatusLight;
