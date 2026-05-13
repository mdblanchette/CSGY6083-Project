"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";

interface Props {
  channel?: string | null;
  workspace?: string | null;
  className?: string;
}

export default function BackToChannelLink({
  channel,
  workspace,
  className,
}: Props) {
  const router = useRouter();
  const { selectWorkspace } = useWorkspace();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (workspace) {
      const id = Number.parseInt(workspace, 10);
      if (Number.isFinite(id)) selectWorkspace(id);
    }
    // Navigate to channel and include workspace param so Home view can pick it up
    if (channel) {
      router.push(
        `/?channel=${channel}${workspace ? `&workspace=${workspace}` : ""}`,
      );
    } else if (workspace) {
      router.push(`/?workspace=${workspace}`);
    } else {
      router.push("/");
    }
  };

  return (
    <a href="#" onClick={handleClick} className={className}>
      ← Back to Channel
    </a>
  );
}
