"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useWorkspace } from "@/context/WorkspaceContext";

const WorkspaceInvitationForm = () => {
  const { activeWorkspace } = useWorkspace();

  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const sendInvite = async () => {
    if (!activeWorkspace?.id || !identifier.trim()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: identifier.trim(),
          }),
        },
      );

      const data = await res.json();

      if (res.ok) {
        toast.success("Invitation sent!");
        setIdentifier("");
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark">
      <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
        Invite User
      </h3>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 outline-none dark:border-stroke-dark dark:text-white"
        />

        <button
          onClick={sendInvite}
          disabled={loading}
          className="rounded-xl bg-primary px-5 py-3 font-medium text-white"
        >
          {loading ? "Sending..." : "Invite"}
        </button>
      </div>
    </div>
  );
};

export default WorkspaceInvitationForm;