"use client";
import React, { createContext, useContext, useState } from "react";

type WorkspaceContextType = {
  showCreateCard: boolean;
  openCreateCard: () => void;
  closeCreateCard: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export const WorkspaceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [showCreateCard, setShowCreateCard] = useState(false);
  const openCreateCard = () => setShowCreateCard(true);
  const closeCreateCard = () => setShowCreateCard(false);

  return (
    <WorkspaceContext.Provider
      value={{ showCreateCard, openCreateCard, closeCreateCard }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};
