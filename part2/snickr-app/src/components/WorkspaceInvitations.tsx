"use client";

import React, { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

type Invitation = {
  id: number;
  workspaceId: number;
  workspaceName: string;
  inviterUsername: string;
  status: string;
};

const WorkspaceInvitations = () => {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();

  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const fetchInvites = async () => {
    if (!activeWorkspace?.id) return;

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/invitations`,
      );

      const data = await res.json();

      if (res.ok) {
        setInvitations(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [activeWorkspace?.id]);

  const respond = async (
    invitationId: number,
    action: "accept" | "decline",
  ) => {
    if (!activeWorkspace?.id) return;

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      );

      if (res.ok) {
        await fetchInvites();
        await refreshWorkspaces();
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark">
      <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
        Pending Invitations
      </h3>

      <div className="space-y-3">
        {invitations.map((invite) => (
          <div
            key={invite.id}
            className="rounded-xl border border-stroke p-4 dark:border-stroke-dark"
          >
            <p className="font-medium text-dark dark:text-white">
              {invite.workspaceName}
            </p>

            <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
              Invited by {invite.inviterUsername}
            </p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => respond(invite.id, "accept")}
                className="rounded-lg bg-green px-4 py-2 text-white"
              >
                Accept
              </button>

              <button
                onClick={() => respond(invite.id, "decline")}
                className="rounded-lg bg-red px-4 py-2 text-white"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkspaceInvitations;