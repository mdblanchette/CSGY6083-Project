"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

type WorkspaceSummary = {
  workspace: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
  };
  channels: Array<{
    id: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    messageCount: number;
  }>;
  members: Array<{
    id: number;
    email: string;
    username: string;
    nickname: string | null;
    isAdmin: boolean;
    joinedAt: string;
  }>;
};

const WorkspaceDashboard = () => {
  const { activeWorkspace, activeWorkspaceId, openCreateCard, showCreateCard } =
    useWorkspace();
  const router = useRouter();
  const lastRedirectedWorkspaceId = useRef<number | null>(null);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!activeWorkspaceId) {
        setSummary(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load workspace summary");
        }

        const data = (await response.json()) as WorkspaceSummary;
        setSummary(data);
      } catch {
        setSummary(null);
        setError("Could not load this workspace.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId || !summary || summary.channels.length === 0) {
      return;
    }

    if (lastRedirectedWorkspaceId.current === activeWorkspaceId) {
      return;
    }

    lastRedirectedWorkspaceId.current = activeWorkspaceId;
    router.replace(`/channels/${summary.channels[0].id}`);
  }, [activeWorkspaceId, router, summary]);

  if (!activeWorkspace) {
    if (showCreateCard) {
      return null;
    }

    return (
      <section className="rounded-2xl border border-stroke bg-white p-8 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Workspaces
          </p>
          <h1 className="mt-3 text-3xl font-bold text-dark dark:text-white">
            Create or select a workspace
          </h1>
          <p className="mt-4 text-dark-4 dark:text-dark-6">
            Choose a workspace from the sidebar to see its channels and members,
            or create a new one to get started.
          </p>

          <button
            type="button"
            onClick={openCreateCard}
            className="mt-6 rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:bg-primary/90"
          >
            Create Workspace
          </button>
        </div>
      </section>
    );
  }

  if (loading && !summary) {
    return (
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="animate-pulse rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-dark-3" />
          <div className="mt-4 h-8 w-2/3 rounded bg-gray-200 dark:bg-dark-3" />
          <div className="mt-3 h-4 w-full rounded bg-gray-200 dark:bg-dark-3" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="h-24 rounded-xl bg-gray-200 dark:bg-dark-3" />
            <div className="h-24 rounded-xl bg-gray-200 dark:bg-dark-3" />
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-dark-3" />
          <div className="mt-4 space-y-3">
            <div className="h-14 rounded-xl bg-gray-200 dark:bg-dark-3" />
            <div className="h-14 rounded-xl bg-gray-200 dark:bg-dark-3" />
            <div className="h-14 rounded-xl bg-gray-200 dark:bg-dark-3" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-2xl border border-stroke bg-white p-8 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          {activeWorkspace.name}
        </h1>
        <p className="mt-3 text-dark-4 dark:text-dark-6">
          {error || "This workspace does not have any content yet."}
        </p>
      </section>
    );
  }

  const memberCount = summary.members.length;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              {summary.workspace.name}
            </h1>
            <p className="mt-3 max-w-2xl text-dark-4 dark:text-dark-6">
              {summary.workspace.description || ""}
            </p>
          </div>

          <div className="rounded-2xl border border-stroke bg-gray-2 px-4 py-3 text-right dark:border-stroke-dark dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
              Created
            </p>
            <p className="mt-1 text-sm font-semibold text-dark dark:text-white">
              {new Date(summary.workspace.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-stroke p-5 dark:border-stroke-dark">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              Channels
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            {summary.channels.length > 0 ? (
              summary.channels.map((channel) => (
                <Link
                  key={channel.id}
                  href={`/channels/${channel.id}`}
                  className="block rounded-2xl border border-stroke bg-gray-2 p-4 transition hover:border-primary hover:shadow-sm dark:border-stroke-dark dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-dark dark:text-white">
                          #{channel.name}
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-4 dark:bg-gray-dark dark:text-dark-6">
                          {channel.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
                        {channel.description || "No channel description yet."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-right text-sm">
                      <div>
                        <p className="text-dark-4 dark:text-dark-6">Members</p>
                        <p className="font-semibold text-dark dark:text-white">
                          {channel.memberCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-dark-4 dark:text-dark-6">Messages</p>
                        <p className="font-semibold text-dark dark:text-white">
                          {channel.messageCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-stroke p-6 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
                This workspace has no channels yet. Create one from the
                workspace flow when you are ready to start organizing
                conversations.
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-dark dark:text-white">
            Members
          </h2>
          <span className="rounded-full bg-gray-2 px-3 py-1 text-xs font-semibold text-dark-4 dark:bg-white/5 dark:text-dark-6">
            {memberCount}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {summary.members.length > 0 ? (
            summary.members.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-dark dark:text-white">
                      {member.nickname || member.username}
                    </p>
                    <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
                      {member.email}
                    </p>
                  </div>

                  {member.isAdmin && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Admin
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-dark-4 dark:text-dark-6">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stroke p-6 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
              No members have been added to this workspace yet.
            </div>
          )}
        </div>
      </aside>
    </section>
  );
};

export default WorkspaceDashboard;
