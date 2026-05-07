"use client";

import React, { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import CreateChannelModal from "./Modals/CreateChannelModal";

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

type ChannelDetail = {
  channel: {
    id: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    messageCount: number;
  };
  messages: Array<{
    id: number;
    body: string;
    postedAt: string;
    senderName: string | null;
    senderEmail: string | null;
  }>;
};

const WorkspaceDashboard = () => {
  const { activeWorkspaceId, openCreateCard, showCreateCard } = useWorkspace();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null,
  );
  const [channelDetail, setChannelDetail] = useState<ChannelDetail | null>(
    null,
  );
  const [channelLoading, setChannelLoading] = useState(false);

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

  const reloadSummary = async () => {
    if (!activeWorkspaceId) return;

    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load workspace summary");
      }

      const data = (await response.json()) as WorkspaceSummary;
      setSummary(data);
    } catch (err) {
      console.error("Failed to reload workspace summary:", err);
    }
  };

  const loadChannelDetail = async (channelId: number) => {
    setSelectedChannelId(channelId);
    setChannelLoading(true);
    try {
      const response = await fetch(
        `/api/channels/${channelId}?workspaceId=${activeWorkspaceId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Failed to load channel details");
      }

      const data = (await response.json()) as ChannelDetail;
      setChannelDetail(data);
    } catch (err) {
      console.error("Failed to load channel details:", err);
      setChannelDetail(null);
    } finally {
      setChannelLoading(false);
    }
  };

  const closeChannelDetail = () => {
    setSelectedChannelId(null);
    setChannelDetail(null);
  };

  if (!activeWorkspaceId) {
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
          </div>
        </div>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-2xl border border-stroke bg-white p-8 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-500">
            Error
          </p>
          <h1 className="mt-3 text-3xl font-bold text-dark dark:text-white">
            {error || "Workspace not found"}
          </h1>
          <p className="mt-4 text-dark-4 dark:text-dark-6">
            Please select a different workspace from the sidebar.
          </p>
        </div>
      </section>
    );
  }

  // Show channel detail when selected
  if (selectedChannelId !== null) {
    if (channelLoading) {
      return (
        <section className="space-y-6">
          <button
            onClick={closeChannelDetail}
            className="text-primary transition hover:text-primary/80"
          >
            ← Back to Workspace
          </button>
          <div className="animate-pulse rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="h-8 w-48 rounded bg-gray-200 dark:bg-dark-3" />
            <div className="mt-4 space-y-3">
              <div className="h-12 rounded bg-gray-200 dark:bg-dark-3" />
              <div className="h-12 rounded bg-gray-200 dark:bg-dark-3" />
              <div className="h-12 rounded bg-gray-200 dark:bg-dark-3" />
            </div>
          </div>
        </section>
      );
    }

    if (!channelDetail) {
      return (
        <section className="space-y-6">
          <button
            onClick={closeChannelDetail}
            className="text-primary transition hover:text-primary/80"
          >
            ← Back to Workspace
          </button>
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <p className="text-dark-4 dark:text-dark-6">
              Failed to load channel details.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="space-y-6">
        <button
          onClick={closeChannelDetail}
          className="text-primary transition hover:text-primary/80"
        >
          ← Back to Workspace
        </button>

        {/* Channel Info */}
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
                Channel
              </p>
              <h2 className="mt-2 text-2xl font-bold text-dark dark:text-white">
                # {channelDetail.channel.name}
              </h2>
              {channelDetail.channel.description && (
                <p className="mt-2 text-dark-4 dark:text-dark-6">
                  {channelDetail.channel.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4">
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20">
                  {channelDetail.channel.type}
                </span>
                <p className="text-xs text-dark-4 dark:text-dark-6">
                  {channelDetail.channel.memberCount} member
                  {channelDetail.channel.memberCount !== 1 ? "s" : ""} •{" "}
                  {channelDetail.channel.messageCount} message
                  {channelDetail.channel.messageCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            Messages
          </h3>
          <div className="mt-6 space-y-4">
            {channelDetail.messages.length > 0 ? (
              channelDetail.messages.map((message) => (
                <div
                  key={message.id}
                  className="border-b border-stroke pb-4 dark:border-stroke-dark"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-dark dark:text-white">
                      {message.senderName || message.senderEmail}
                    </p>
                    <p className="text-xs text-dark-4 dark:text-dark-6">
                      {new Date(message.postedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 text-dark-4 dark:text-dark-6">
                    {message.body}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-dark-4 dark:text-dark-6">
                No messages yet.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      {/* Workspace Info & Channels */}
      <div className="space-y-6">
        {/* Workspace Info Card */}
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
            Workspace
          </p>
          <h2 className="mt-2 text-2xl font-bold text-dark dark:text-white">
            {summary.workspace.name}
          </h2>
          {summary.workspace.description && (
            <p className="mt-2 text-dark-4 dark:text-dark-6">
              {summary.workspace.description}
            </p>
          )}
          <p className="mt-4 text-xs text-dark-4 dark:text-dark-6">
            Created {new Date(summary.workspace.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Channels */}
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
                Channels
              </p>
              <h3 className="mt-1 text-lg font-semibold text-dark dark:text-white">
                {summary.channels.length} channel
                {summary.channels.length !== 1 ? "s" : ""}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateChannelModal(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              + Add
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {summary.channels.length > 0 ? (
              summary.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => loadChannelDetail(channel.id)}
                  className="w-full rounded-xl border border-stroke bg-gray-1 p-4 text-left transition hover:border-primary dark:border-stroke-dark dark:bg-dark-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-dark dark:text-white">
                        # {channel.name}
                      </h4>
                      {channel.description && (
                        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
                          {channel.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-dark-4 dark:text-dark-6">
                        {channel.memberCount} member
                        {channel.memberCount !== 1 ? "s" : ""} •{" "}
                        {channel.messageCount} message
                        {channel.messageCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20">
                      {channel.type}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-dark-4 dark:text-dark-6">
                No channels yet. Create one to get started.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
          Members
        </p>
        <h3 className="mt-1 text-lg font-semibold text-dark dark:text-white">
          {summary.members.length} member
          {summary.members.length !== 1 ? "s" : ""}
        </h3>

        <div className="mt-6 space-y-3">
          {summary.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-xl bg-gray-1 p-3 dark:bg-dark-3"
            >
              <div>
                <p className="font-medium text-dark dark:text-white">
                  {member.nickname || member.username}
                </p>
                <p className="text-xs text-dark-4 dark:text-dark-6">
                  {member.email}
                </p>
              </div>
              {member.isAdmin && (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary dark:bg-primary/20">
                  Admin
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <CreateChannelModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowCreateChannelModal(false)}
          onChannelCreated={(newChannelId: number) => {
            reloadSummary();
            setShowCreateChannelModal(false);
            // Optionally, select the new channel
            setTimeout(() => loadChannelDetail(newChannelId), 300);
          }}
        />
      )}
    </section>
  );
};

export default WorkspaceDashboard;
