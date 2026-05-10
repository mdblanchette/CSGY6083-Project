"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import CreateChannelModal from "./Modals/CreateChannelModal";
import WorkspaceInvitationForm from "./WorkspaceInvitationForm";
import ChannelInvitationForm from "./ChannelInvitationForm";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  joinedAt: string;
};

type WorkspaceSummary = {
  workspace: { id: number; name: string; description: string | null; createdAt: string };
  channels: Array<{
    id: number; name: string; type: string; description: string | null;
    createdAt: string; memberCount: number; messageCount: number;
  }>;
  members: Member[];
};

type ChannelDetail = {
  channel: {
    id: number; name: string; type: string; description: string | null;
    createdAt: string; memberCount: number; messageCount: number;
  };
  messages: Array<{
    id: number; body: string; postedAt: string;
    senderName: string | null; senderNickname: string | null;
    senderEmail: string | null; senderImage: string | null;
  }>;
  currentUser: { isMember: boolean; isAdmin: boolean } | null;
};

type ChannelMessageResponse = {
  message: {
    id: number; body: string; postedAt: string;
    senderName: string | null; senderNickname: string | null;
    senderEmail: string | null; senderImage: string | null;
  };
  channel: { id: number; memberCount: number };
};

type PendingChannelInvitation = {
  id: number; channelId: number; channelName: string;
  inviterId: number; inviterUsername: string; invitedAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const displayName = (m: Member) => m.nickname || m.username;

// ── Component ─────────────────────────────────────────────────────────────────

const WorkspaceDashboard = () => {
  const { data: session } = useSession();
  const { activeWorkspaceId, openCreateCard, showCreateCard, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const channelIdFromUrl = (() => {
    const v = searchParams.get("channel");
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  })();

  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [channelDetail, setChannelDetail] = useState<ChannelDetail | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);

  const [messageBody, setMessageBody] = useState("");
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [pendingChannelInvites, setPendingChannelInvites] = useState<PendingChannelInvitation[]>([]);
  const [leavingWorkspace, setLeavingWorkspace] = useState(false);
  const [leavingChannel, setLeavingChannel] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [togglingChannelType, setTogglingChannelType] = useState(false);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState("");
  const [savingWorkspaceName, setSavingWorkspaceName] = useState(false);
  const [editingChannelName, setEditingChannelName] = useState(false);
  const [channelNameInput, setChannelNameInput] = useState("");
  const [savingChannelName, setSavingChannelName] = useState(false);
  const [memberActionId, setMemberActionId] = useState<number | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadSummary = async () => {
    if (!activeWorkspaceId) { setSummary(null); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setSummary(await res.json());
    } catch {
      setSummary(null); setError("Could not load this workspace.");
    } finally {
      setLoading(false);
    }
  };

  const loadPendingChannelInvites = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/channel-invitations`, { cache: "no-store" });
      if (res.ok) setPendingChannelInvites(await res.json());
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    loadSummary();
    loadPendingChannelInvites();
    // Clear channel param when workspace changes
    router.replace(pathname, { scroll: false });
    setSelectedChannelId(null);
    setChannelDetail(null);
    setPendingChannelInvites([]);
  }, [activeWorkspaceId]);

  const reloadSummary = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch { /* ignore */ }
  };

  // ── Channel detail ────────────────────────────────────────────────────────

  const doLoadChannelDetail = async (channelId: number) => {
    setSelectedChannelId(channelId); setChannelLoading(true);
    setMessageBody(""); setMessageError(null);
    try {
      const res = await fetch(`/api/channels/${channelId}?workspaceId=${activeWorkspaceId}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setChannelDetail(await res.json());
    } catch {
      setChannelDetail(null);
    } finally {
      setChannelLoading(false);
    }
  };

  // Clicking a channel updates the URL; the effect below does the actual load
  const loadChannelDetail = (channelId: number) => {
    router.push(`${pathname}?channel=${channelId}`, { scroll: false });
  };

  // ← Back button: replace so browser history doesn't accumulate a workspace entry
  const closeChannelDetail = () => {
    router.replace(pathname, { scroll: false });
  };

  // Sync URL channel param → channel detail state
  useEffect(() => {
    if (!channelIdFromUrl) {
      setSelectedChannelId(null);
      setChannelDetail(null);
      setMessageBody("");
      setMessageError(null);
      return;
    }
    if (channelIdFromUrl !== selectedChannelId) {
      doLoadChannelDetail(channelIdFromUrl);
    }
  }, [channelIdFromUrl]);

  const submitMessage = async () => {
    if (!selectedChannelId || !channelDetail) return;
    const trimmedBody = messageBody.trim();
    if (!trimmedBody) { setMessageError("Message cannot be empty."); return; }
    setMessageSubmitting(true); setMessageError(null);
    try {
      const res = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmedBody }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to send message.");
      const data = payload as ChannelMessageResponse;
      setChannelDetail((prev) => prev ? {
        ...prev,
        channel: { ...prev.channel, memberCount: data.channel.memberCount, messageCount: prev.channel.messageCount + 1 },
        messages: [...prev.messages, data.message],
      } : prev);
      setSummary((prev) => prev ? {
        ...prev,
        channels: prev.channels.map((ch) =>
          ch.id === data.channel.id
            ? { ...ch, memberCount: data.channel.memberCount, messageCount: ch.messageCount + 1 }
            : ch,
        ),
      } : prev);
      setMessageBody("");
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setMessageSubmitting(false);
    }
  };

  // ── Leave actions ─────────────────────────────────────────────────────────

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspaceId || !confirm("Are you sure you want to leave this workspace?")) return;
    setLeavingWorkspace(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("You have left the workspace.");
        await refreshWorkspaces();
      } else {
        toast.error(data.error || "Failed to leave workspace");
      }
    } catch {
      toast.error("Failed to leave workspace");
    } finally {
      setLeavingWorkspace(false);
    }
  };

  const handleLeaveChannel = async () => {
    if (!selectedChannelId || !confirm("Are you sure you want to leave this channel?")) return;
    setLeavingChannel(true);
    try {
      const res = await fetch(`/api/channels/${selectedChannelId}/members`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("You have left the channel.");
        closeChannelDetail(); reloadSummary();
      } else {
        toast.error(data.error || "Failed to leave channel");
      }
    } catch {
      toast.error("Failed to leave channel");
    } finally {
      setLeavingChannel(false);
    }
  };

  const handleSaveWorkspaceName = async () => {
    if (!activeWorkspaceId || !workspaceNameInput.trim()) return;
    setSavingWorkspaceName(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceNameInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Workspace renamed.");
        setSummary((prev) => prev ? { ...prev, workspace: { ...prev.workspace, name: data.name } } : prev);
        await refreshWorkspaces();
        setEditingWorkspaceName(false);
      } else {
        toast.error(data.error || "Failed to rename workspace");
      }
    } catch {
      toast.error("Failed to rename workspace");
    } finally {
      setSavingWorkspaceName(false);
    }
  };

  const handleSaveChannelName = async () => {
    if (!selectedChannelId || !channelNameInput.trim()) return;
    setSavingChannelName(true);
    try {
      const res = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: channelNameInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Channel renamed.");
        setChannelDetail((prev) =>
          prev ? { ...prev, channel: { ...prev.channel, name: data.name } } : prev,
        );
        reloadSummary();
        setEditingChannelName(false);
      } else {
        toast.error(data.error || "Failed to rename channel");
      }
    } catch {
      toast.error("Failed to rename channel");
    } finally {
      setSavingChannelName(false);
    }
  };

  const handleToggleChannelType = async () => {
    if (!selectedChannelId || !channelDetail) return;
    const current = channelDetail.channel.type.toLowerCase();
    const next = current === "private" ? "public" : "private";
    if (!confirm(`Change #${channelDetail.channel.name} from ${current} to ${next}?`)) return;
    setTogglingChannelType(true);
    try {
      const res = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Channel is now ${next}.`);
        setChannelDetail((prev) =>
          prev ? { ...prev, channel: { ...prev.channel, type: next } } : prev,
        );
        reloadSummary();
      } else {
        toast.error(data.error || "Failed to update channel");
      }
    } catch {
      toast.error("Failed to update channel");
    } finally {
      setTogglingChannelType(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!selectedChannelId || !channelDetail) return;
    if (!confirm(`Delete #${channelDetail.channel.name}? This cannot be undone.`)) return;
    setDeletingChannel(true);
    try {
      const res = await fetch(`/api/channels/${selectedChannelId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Channel deleted.");
        closeChannelDetail();
        reloadSummary();
      } else {
        toast.error(data.error || "Failed to delete channel");
      }
    } catch {
      toast.error("Failed to delete channel");
    } finally {
      setDeletingChannel(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId || !summary) return;
    if (!confirm(`Delete "${summary.workspace.name}"? This will permanently remove the workspace and all its channels. This cannot be undone.`)) return;
    setDeletingWorkspace(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Workspace deleted.");
        await refreshWorkspaces();
      } else {
        toast.error(data.error || "Failed to delete workspace");
      }
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setDeletingWorkspace(false);
    }
  };

  // ── Member admin actions ──────────────────────────────────────────────────

  const handleMemberAction = async (
    member: Member,
    action: "promote" | "demote" | "remove",
  ) => {
    if (!activeWorkspaceId) return;
    if (action === "remove" && !confirm(`Remove ${displayName(member)} from the workspace?`)) return;

    setMemberActionId(member.id);
    try {
      let res: Response;
      if (action === "remove") {
        res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${member.id}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }
      const data = await res.json();
      if (res.ok) {
        const label =
          action === "promote"
            ? member.isAdmin ? `${displayName(member)} is now an owner.` : `${displayName(member)} promoted to admin.`
            : action === "demote"
            ? `${displayName(member)} demoted to member.`
            : `${displayName(member)} has been removed.`;
        toast.success(label);
        reloadSummary();
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setMemberActionId(null);
    }
  };

  // ── Channel invitation response ───────────────────────────────────────────

  const respondToChannelInvite = async (invite: PendingChannelInvitation, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/channels/${invite.channelId}/invitations/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === "accept" ? "You joined the channel!" : "Invitation declined.");
        setPendingChannelInvites((prev) => prev.filter((i) => i.id !== invite.id));
        if (action === "accept") reloadSummary();
      } else {
        toast.error(data.error || "Failed to respond to invitation");
      }
    } catch {
      toast.error("Failed to respond to invitation");
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!activeWorkspaceId) {
    if (showCreateCard) return null;
    return (
      <section className="rounded-2xl border border-stroke bg-white p-8 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Workspaces</p>
          <h1 className="mt-3 text-3xl font-bold text-dark dark:text-white">Create or select a workspace</h1>
          <p className="mt-4 text-dark-4 dark:text-dark-6">
            Choose a workspace from the sidebar, or create a new one to get started.
          </p>
          <button type="button" onClick={openCreateCard}
            className="mt-6 rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:bg-primary/90">
            Create Workspace
          </button>
        </div>
      </section>
    );
  }

  if (loading && !summary) {
    return (
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-dark-3" />
            <div className="mt-4 h-8 w-2/3 rounded bg-gray-200 dark:bg-dark-3" />
            <div className="mt-6 space-y-3">
              <div className="h-14 rounded-xl bg-gray-200 dark:bg-dark-3" />
              <div className="h-14 rounded-xl bg-gray-200 dark:bg-dark-3" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-2xl border border-stroke bg-white p-8 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <p className="text-sm font-medium uppercase text-red-500">Error</p>
        <h1 className="mt-3 text-3xl font-bold text-dark dark:text-white">{error || "Workspace not found"}</h1>
      </section>
    );
  }

  // Compute workspace role once — available to both channel detail and main views
  const currentMember = summary.members.find((m) => m.username === session?.user?.username);
  const isWorkspaceAdmin = currentMember?.isAdmin ?? false;
  const isWorkspaceOwner = currentMember?.isOwner ?? false;

  // ── Channel detail view ───────────────────────────────────────────────────

  if (selectedChannelId !== null) {
    if (channelLoading) {
      return (
        <section className="space-y-6">
          <button onClick={closeChannelDetail} className="text-primary transition hover:text-primary/80">← Back to Workspace</button>
          <div className="animate-pulse rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="h-8 w-48 rounded bg-gray-200 dark:bg-dark-3" />
            <div className="mt-4 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-12 rounded bg-gray-200 dark:bg-dark-3" />)}</div>
          </div>
        </section>
      );
    }
    if (!channelDetail) {
      return (
        <section className="space-y-6">
          <button onClick={closeChannelDetail} className="text-primary transition hover:text-primary/80">← Back to Workspace</button>
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <p className="text-dark-4 dark:text-dark-6">Failed to load channel details.</p>
          </div>
        </section>
      );
    }

    const isPrivate = channelDetail.channel.type.toLowerCase() === "private";
    const isChannelAdmin = channelDetail.currentUser?.isAdmin ?? false;
    const isChannelMember = channelDetail.currentUser?.isMember ?? false;

    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={closeChannelDetail} className="text-primary transition hover:text-primary/80">
            ← Back to Workspace
          </button>
          <div className="flex gap-2">
            {isChannelMember && isPrivate && !isWorkspaceOwner && (
              <button onClick={handleLeaveChannel} disabled={leavingChannel}
                className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20">
                {leavingChannel ? "Leaving…" : "Leave Channel"}
              </button>
            )}
            {(isWorkspaceAdmin || isWorkspaceOwner) && (
              <button onClick={handleDeleteChannel} disabled={deletingChannel}
                className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60">
                {deletingChannel ? "Deleting…" : "Delete Channel"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">Channel</p>
          {editingChannelName ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xl font-bold text-dark dark:text-white">#</span>
              <input
                autoFocus
                value={channelNameInput}
                onChange={(e) => setChannelNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveChannelName();
                  if (e.key === "Escape") setEditingChannelName(false);
                }}
                className="flex-1 rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-xl font-bold text-dark outline-none focus:border-primary dark:border-stroke-dark dark:text-white"
              />
              <button onClick={handleSaveChannelName} disabled={savingChannelName}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                {savingChannelName ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingChannelName(false)}
                className="rounded-lg border border-stroke px-3 py-1.5 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-bold text-dark dark:text-white"># {channelDetail.channel.name}</h2>
              {(isWorkspaceAdmin || isWorkspaceOwner) && (
                <button
                  onClick={() => { setChannelNameInput(channelDetail.channel.name); setEditingChannelName(true); }}
                  className="text-dark-4 transition hover:text-primary dark:text-dark-6"
                  title="Rename channel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
            </div>
          )}
          {channelDetail.channel.description && <p className="mt-2 text-dark-4 dark:text-dark-6">{channelDetail.channel.description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20">
              {channelDetail.channel.type}
            </span>
            {(isWorkspaceAdmin || isWorkspaceOwner) && (
              <button
                onClick={handleToggleChannelType}
                disabled={togglingChannelType}
                className="inline-flex rounded-full border border-stroke px-3 py-1 text-xs font-medium text-dark-4 transition hover:border-primary hover:text-primary disabled:opacity-60 dark:border-stroke-dark dark:text-dark-6"
              >
                {togglingChannelType ? "Updating…" : isPrivate ? "Make Public" : "Make Private"}
              </button>
            )}
            <p className="text-xs text-dark-4 dark:text-dark-6">
              {channelDetail.channel.memberCount} member{channelDetail.channel.memberCount !== 1 ? "s" : ""} •{" "}
              {channelDetail.channel.messageCount} message{channelDetail.channel.messageCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {isPrivate && isChannelAdmin && <ChannelInvitationForm channelId={selectedChannelId} />}

        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Messages</h3>
          <div className="mt-6 max-h-[30vh] space-y-4 overflow-y-auto pr-2">
            {channelDetail.messages.length > 0 ? (
              channelDetail.messages.map((message) => {
                const senderHref = message.senderName
                  ? message.senderName === session?.user?.username ? "/profile" : `/profile/${message.senderName}`
                  : "#";
                const senderLabel = message.senderNickname || message.senderName || message.senderEmail || "System";
                const initial = senderLabel.charAt(0).toUpperCase();
                const imgOk = message.senderImage && (message.senderImage.startsWith("http") || message.senderImage.startsWith("/"));
                return (
                  <div key={message.id} className="border-b border-stroke pb-4 dark:border-stroke-dark">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link href={senderHref} className="shrink-0">
                          {imgOk ? (
                            <Image src={message.senderImage!} alt={senderLabel} width={40} height={40}
                              className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-base font-semibold text-gray-700 dark:bg-gray-700 dark:text-white">
                              {initial}
                            </span>
                          )}
                        </Link>
                        <Link href={senderHref} className="truncate font-medium text-dark hover:text-primary dark:text-white dark:hover:text-primary">
                          {senderLabel}
                        </Link>
                      </div>
                      <p className="text-xs text-dark-4 dark:text-dark-6">{new Date(message.postedAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-dark-4 dark:text-dark-6">{message.body}</p>
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-center text-dark-4 dark:text-dark-6">No messages yet.</p>
            )}
          </div>

          <div className="mt-6 border-t border-stroke pt-5 dark:border-stroke-dark">
            <label htmlFor="channel-message-body" className="text-sm font-medium text-dark dark:text-white">Send a message</label>
            <textarea
              id="channel-message-body" value={messageBody} rows={3}
              onChange={(e) => { setMessageBody(e.target.value); if (messageError) setMessageError(null); }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (!messageSubmitting && messageBody.trim().length > 0) void submitMessage();
              }}
              placeholder="Write something to the channel..."
              className="mt-2 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-white"
            />
            {messageError && <p className="mt-2 text-sm text-red-500">{messageError}</p>}
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={submitMessage}
                disabled={messageSubmitting || messageBody.trim().length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {messageSubmitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Workspace main view (two-column) ──────────────────────────────────────

  return (
    <section className="space-y-6">
      {/* Workspace header */}
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">Workspace</p>
        {editingWorkspaceName ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={workspaceNameInput}
              onChange={(e) => setWorkspaceNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveWorkspaceName();
                if (e.key === "Escape") setEditingWorkspaceName(false);
              }}
              className="flex-1 rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-xl font-bold text-dark outline-none focus:border-primary dark:border-stroke-dark dark:text-white"
            />
            <button onClick={handleSaveWorkspaceName} disabled={savingWorkspaceName}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              {savingWorkspaceName ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingWorkspaceName(false)}
              className="rounded-lg border border-stroke px-3 py-1.5 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-2xl font-bold text-dark dark:text-white">{summary.workspace.name}</h2>
            {(isWorkspaceAdmin || isWorkspaceOwner) && (
              <button
                onClick={() => { setWorkspaceNameInput(summary.workspace.name); setEditingWorkspaceName(true); }}
                className="text-dark-4 transition hover:text-primary dark:text-dark-6"
                title="Rename workspace"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
        )}
        {summary.workspace.description && <p className="mt-2 text-dark-4 dark:text-dark-6">{summary.workspace.description}</p>}
        <p className="mt-3 text-xs text-dark-4 dark:text-dark-6">
          Created {new Date(summary.workspace.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">

        {/* ── Left: Channels ── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">Channels</p>
                <h3 className="mt-1 text-lg font-semibold text-dark dark:text-white">
                  {summary.channels.length} channel{summary.channels.length !== 1 ? "s" : ""}
                </h3>
              </div>
              {(isWorkspaceAdmin || isWorkspaceOwner) && (
                <button type="button" onClick={() => setShowCreateChannelModal(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90">
                  + Add
                </button>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {summary.channels.length > 0 ? (
                summary.channels.map((channel) => (
                  <button key={channel.id} onClick={() => loadChannelDetail(channel.id)}
                    className="w-full rounded-xl border border-stroke bg-gray-1 p-4 text-left transition hover:border-primary dark:border-stroke-dark dark:bg-dark-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-dark dark:text-white"># {channel.name}</h4>
                        {channel.description && <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{channel.description}</p>}
                        <p className="mt-2 text-xs text-dark-4 dark:text-dark-6">
                          {channel.memberCount} member{channel.memberCount !== 1 ? "s" : ""} •{" "}
                          {channel.messageCount} message{channel.messageCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20">
                        {channel.type}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-8 text-center text-dark-4 dark:text-dark-6">No channels yet. Create one to get started.</p>
              )}
            </div>
          </div>

          {/* Pending channel invitations */}
          {pendingChannelInvites.length > 0 && (
            <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">Channel Invitations</p>
              <h3 className="mt-1 text-lg font-semibold text-dark dark:text-white">{pendingChannelInvites.length} pending</h3>
              <div className="mt-4 space-y-3">
                {pendingChannelInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between rounded-xl bg-gray-1 p-3 dark:bg-dark-3">
                    <div>
                      <p className="font-medium text-dark dark:text-white"># {invite.channelName}</p>
                      <p className="text-xs text-dark-4 dark:text-dark-6">Invited by {invite.inviterUsername}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondToChannelInvite(invite, "accept")}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90">
                        Accept
                      </button>
                      <button onClick={() => respondToChannelInvite(invite, "decline")}
                        className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-dark-4 transition hover:border-red-300 hover:text-red-500 dark:border-dark-3 dark:text-dark-6">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Members ── */}
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">Members</p>
              <h3 className="mt-1 text-lg font-semibold text-dark dark:text-white">
                {summary.members.length} member{summary.members.length !== 1 ? "s" : ""}
              </h3>
            </div>
            {isWorkspaceAdmin && (
              <button type="button" onClick={() => setShowInviteForm((p) => !p)}
                className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-medium text-primary transition hover:border-primary dark:border-stroke-dark dark:text-white">
                {showInviteForm ? "Hide" : "Invite"}
              </button>
            )}
          </div>

          {showInviteForm && isWorkspaceAdmin && (
            <div className="mt-4"><WorkspaceInvitationForm /></div>
          )}

          <div className="mt-5 space-y-2">
            {summary.members.map((member) => {
              const isSelf = member.username === session?.user?.username;
              const profileHref = isSelf ? "/profile" : `/profile/${member.username}`;
              const isActing = memberActionId === member.id;

              // What actions can the current user take on this member?
              const canPromoteToAdmin = (isWorkspaceAdmin || isWorkspaceOwner) && !member.isAdmin && !member.isOwner && !isSelf;
              const canDemote = isWorkspaceOwner && member.isAdmin && !member.isOwner && !isSelf;
              const canRemove = (isWorkspaceOwner || isWorkspaceAdmin) && !member.isOwner && !isSelf &&
                (isWorkspaceOwner || !member.isAdmin);

              return (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-1 p-3 dark:bg-dark-3">
                  <div className="min-w-0">
                    <Link href={profileHref}
                      className="block truncate font-medium text-dark hover:text-primary dark:text-white dark:hover:text-primary">
                      {displayName(member)}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-dark-4 dark:text-dark-6">(you)</span>}
                    </Link>
                    <p className="truncate text-xs text-dark-4 dark:text-dark-6">{member.email}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {member.isOwner && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Owner
                      </span>
                    )}
                    {member.isAdmin && !member.isOwner && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
                        Admin
                      </span>
                    )}

                    {/* Promote regular → admin */}
                    {canPromoteToAdmin && (
                      <button onClick={() => handleMemberAction(member, "promote")} disabled={isActing}
                        className="rounded-lg border border-stroke px-2 py-1 text-xs font-medium text-dark-4 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-3 dark:text-dark-6">
                        {isActing ? "…" : "Make Admin"}
                      </button>
                    )}

                    {canDemote && (
                      <button onClick={() => handleMemberAction(member, "demote")} disabled={isActing}
                        className="rounded-lg border border-stroke px-2 py-1 text-xs font-medium text-dark-4 transition hover:border-orange-400 hover:text-orange-500 disabled:opacity-50 dark:border-dark-3 dark:text-dark-6">
                        {isActing ? "…" : "Demote"}
                      </button>
                    )}

                    {/* Remove */}
                    {canRemove && (
                      <button onClick={() => handleMemberAction(member, "remove")} disabled={isActing}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/20">
                        {isActing ? "…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {currentMember && (
            isWorkspaceOwner ? (
              <button onClick={handleDeleteWorkspace} disabled={deletingWorkspace}
                className="mt-6 w-full rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60">
                {deletingWorkspace ? "Deleting…" : "Delete Workspace"}
              </button>
            ) : (
              <button onClick={handleLeaveWorkspace} disabled={leavingWorkspace}
                className="mt-6 w-full rounded-xl border border-red-300 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20">
                {leavingWorkspace ? "Leaving…" : "Leave Workspace"}
              </button>
            )
          )}
        </div>
      </div>

      {showCreateChannelModal && (
        <CreateChannelModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowCreateChannelModal(false)}
          onChannelCreated={(newChannelId: number) => {
            reloadSummary();
            setShowCreateChannelModal(false);
            setTimeout(() => loadChannelDetail(newChannelId), 300);
          }}
        />
      )}
    </section>
  );
};

export default WorkspaceDashboard;
