"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import CreateWorkspaceCard from "@/components/CreateWorkspaceCard";
import WorkspaceDashboard from "@/components/WorkspaceDashboard";

const HomeWorkspaceView = () => {
  const { showCreateCard, selectWorkspace } = useWorkspace();
  const searchParams = useSearchParams();
  const workspaceIdFromUrl = (() => {
    const v = searchParams.get("workspace");
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  })();

  // When workspace param is in URL, select that workspace
  useEffect(() => {
    if (workspaceIdFromUrl) {
      selectWorkspace(workspaceIdFromUrl);
    }
  }, [workspaceIdFromUrl, selectWorkspace]);

  if (showCreateCard) {
    return <CreateWorkspaceCard />;
  }

  return <WorkspaceDashboard />;
};

export default HomeWorkspaceView;
