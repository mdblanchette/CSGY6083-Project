"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import ClickOutside from "@/components/ClickOutside";

const WorkspaceDropdown = () => {
  const router = useRouter();

  const { openCreateCard, workspaces, activeWorkspace, selectWorkspace } =
    useWorkspace();

  const [open, setOpen] = useState(false);

  const handleWorkspaceSelect = (workspaceId: number) => {
    selectWorkspace(workspaceId);
    setOpen(false);
    //router.push(`/workspaces/${workspaceId}`);
    router.push(`/`);
  };

  const handleCreateWorkspace = () => {
    setOpen(false);
    openCreateCard();
  };

  return (
    <div className="border-b border-stroke px-4 py-3 dark:border-stroke-dark">
      <ClickOutside onClick={() => setOpen(false)}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stroke bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary dark:border-stroke-dark dark:bg-gray-dark"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
                Workspace
              </p>

              <span className="block truncate text-sm font-semibold text-dark dark:text-white">
                {activeWorkspace?.name ?? "Create Workspace"}
              </span>
            </div>

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
            <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-stroke bg-white p-2 shadow-xl dark:border-stroke-dark dark:bg-gray-dark">
              <div className="max-h-72 overflow-y-auto">
                {workspaces.length > 0 ? (
                  <ul className="space-y-1">
                    {workspaces.map((workspace) => {
                      const isActive = activeWorkspace?.id === workspace.id;

                      return (
                        <li key={workspace.id}>
                          <button
                            type="button"
                            onClick={() =>
                              handleWorkspaceSelect(workspace.id)
                            }
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-dark hover:bg-gray-50 dark:text-white dark:hover:bg-white/5"
                            }`}
                          >
                            <span className="truncate font-medium">
                              {workspace.name}
                            </span>

                            {isActive && (
                              <span className="ml-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                                Active
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="rounded-xl px-3 py-2 text-sm text-dark-4 dark:text-dark-6">
                    No workspaces yet.
                  </div>
                )}

                <div className="mt-2 border-t border-stroke px-1 pt-2 dark:border-stroke-dark">
                  <button
                    type="button"
                    onClick={handleCreateWorkspace}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-primary transition hover:bg-primary/5"
                  >
                    <span className="font-medium">Create new workspace</span>
                    <span className="text-lg leading-none">+</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ClickOutside>
    </div>
  );
};

export default WorkspaceDropdown;