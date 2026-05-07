"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useLocalStorage from "@/hooks/useLocalStorage";

export type Workspace = {
  id: number;
  name: string;
  description?: string | null;
  createdAt?: string;
};

type WorkspaceContextType = {
  showCreateCard: boolean;
  openCreateCard: () => void;
  closeCreateCard: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: number | null;
  activeWorkspace: Workspace | null;
  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (workspaceId: number) => void;
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useLocalStorage<
    number | null
  >("snickr-active-workspace", null);

  const openCreateCard = () => setShowCreateCard(true);
  const closeCreateCard = () => setShowCreateCard(false);

  const refreshWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces");
      if (!response.ok) {
        setWorkspaces([]);
        return;
      }

      const data = (await response.json()) as Workspace[];
      setWorkspaces(data);

      if (data.length === 0) {
        setActiveWorkspaceId(null);
        return;
      }

      const selectedWorkspaceExists = data.some(
        (workspace) => workspace.id === activeWorkspaceId,
      );

      if (!selectedWorkspaceExists) {
        setActiveWorkspaceId(data[0].id);
      }
    } catch {
      setWorkspaces([]);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  const activeWorkspace = useMemo(() => {
    if (!workspaces.length) return null;
    return (
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0]
    );
  }, [activeWorkspaceId, workspaces]);

  const selectWorkspace = (workspaceId: number) => {
    setActiveWorkspaceId(workspaceId);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        showCreateCard,
        openCreateCard,
        closeCreateCard,
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        refreshWorkspaces,
        selectWorkspace,
      }}
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
