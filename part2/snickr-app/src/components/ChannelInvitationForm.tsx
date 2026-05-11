"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";

interface ChannelInvitationFormProps {
  channelId: number;
}

const ChannelInvitationForm = ({ channelId }: ChannelInvitationFormProps) => {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const sendInvite = async () => {
    if (!identifier.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Invitation sent!");
        setIdentifier("");
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-gray-dark">
      <h3 className="mb-4 text-base font-semibold text-dark dark:text-white">
        Invite to Channel
      </h3>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && sendInvite()}
          className="w-full rounded-xl border border-stroke bg-transparent px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-stroke-dark dark:text-white"
        />
        <button
          onClick={sendInvite}
          disabled={loading || !identifier.trim()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Invite"}
        </button>
      </div>
    </div>
  );
};

export default ChannelInvitationForm;
