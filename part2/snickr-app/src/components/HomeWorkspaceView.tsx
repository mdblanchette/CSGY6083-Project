"use client";

import React from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import CreateWorkspaceCard from "@/components/CreateWorkspaceCard";
import WorkspaceDashboard from "@/components/WorkspaceDashboard";

const HomeWorkspaceView = () => {
  const { showCreateCard } = useWorkspace();

  if (showCreateCard) {
    return <CreateWorkspaceCard />;
  }

  return <WorkspaceDashboard />;
};

export default HomeWorkspaceView;
