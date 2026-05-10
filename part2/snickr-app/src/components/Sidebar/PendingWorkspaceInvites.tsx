"use client";

import React, { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

type PendingInvite = {
  id: number;
  workspaceId: number;
  workspaceName: string;
  inviterUsername: string;
  invitedAt: string;
};

const PendingWorkspaceInvites = () => {
  const { refreshWorkspaces } = useWorkspace();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace-invitations", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to load invitations");
        setInvites([]);
        return;
      }

      setInvites(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load invitations");
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvites();
  }, []);

  const respondInvite = async (
    workspaceId: number,
    invitationId: number,
    action: "accept" | "decline",
  ) => {
    setSubmittingId(invitationId);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to respond to invitation");
        return;
      }

      setInvites((current) =>
        current.filter((invite) => invite.id !== invitationId),
      );

      if (action === "accept") {
        await refreshWorkspaces();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to respond to invitation");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-stroke bg-white p-3 text-sm text-dark-4 dark:border-stroke-dark dark:bg-gray-dark dark:text-dark-6">
        Loading pending invites...
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="rounded-xl border border-stroke bg-white p-3 text-sm text-dark-4 dark:border-stroke-dark dark:bg-gray-dark dark:text-dark-6">
        No pending workspace invitations.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="rounded-xl border border-stroke bg-gray-50 p-3 dark:border-stroke-dark dark:bg-dark-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-dark dark:text-white">
                {invite.workspaceName}
              </p>
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                Invited by {invite.inviterUsername}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/20">
              Pending
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => respondInvite(invite.workspaceId, invite.id, "accept")}
              disabled={submittingId === invite.id}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittingId === invite.id ? "Saving..." : "Accept"}
            </button>
            <button
              type="button"
              onClick={() => respondInvite(invite.workspaceId, invite.id, "decline")}
              disabled={submittingId === invite.id}
              className="inline-flex items-center justify-center rounded-xl border border-stroke bg-white px-3 py-2 text-xs font-semibold text-dark transition hover:bg-gray-50 dark:border-stroke-dark dark:bg-dark-2 dark:text-white dark:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingWorkspaceInvites;
