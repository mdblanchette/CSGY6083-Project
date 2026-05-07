"use client";
import React, { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

type Workspace = { id: number; name: string; description?: string | null };

const WorkspaceDropdown = () => {
  const { openCreateCard } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await fetch("/api/workspaces");
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data);
        } else {
          setWorkspaces([]);
        }
      } catch (err) {
        setWorkspaces([]);
      }
    };
    fetchWorkspaces();
  }, []);

  // If no workspaces yet, render the primary button that opens create card
  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="border-b border-stroke px-6 py-5 dark:border-stroke-dark">
        <button
          type="button"
          onClick={() => openCreateCard()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary/90"
        >
          Create Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-stroke px-4 py-3 dark:border-stroke-dark">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-stroke px-3 py-2 text-left"
        >
          <span>{workspaces[0].name}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded bg-white shadow-lg">
            <ul>
              {workspaces.map((w) => (
                <li key={w.id} className="px-3 py-2 hover:bg-gray-50">
                  {w.name}
                </li>
              ))}
              <li className="border-t px-3 py-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    openCreateCard();
                  }}
                  className="w-full text-left text-primary"
                >
                  + Create Workspace
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceDropdown;
