"use client";

import React, { useState } from "react";
import { useEffect } from "react";
import toast from "react-hot-toast";

interface CreateChannelModalProps {
  workspaceId: number;
  onClose: () => void;
  onChannelCreated?: (channelId: number) => void;
}

type WorkspaceSummaryResponse = {
  currentUserId: number;
  members: WorkspaceMember[];
};

type WorkspaceMember = {
  id: number;
  email: string;
  username: string;
  nickname: string | null;
  isAdmin: boolean;
  joinedAt: string;
};

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  workspaceId,
  onClose,
  onChannelCreated,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    channelType: "public",
  });
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    [],
  );
  const [selectedDirectUserId, setSelectedDirectUserId] = useState<string>("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadMembers = async () => {
      setMembersLoading(true);

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load workspace members");
        }

        const data = (await response.json()) as WorkspaceSummaryResponse;

        if (isActive) {
          const members = Array.isArray(data?.members) ? data.members : [];
          setWorkspaceMembers(
            members.filter((member) => member.id !== data.currentUserId),
          );
        }
      } catch {
        if (isActive) {
          setWorkspaceMembers([]);
        }
      } finally {
        if (isActive) {
          setMembersLoading(false);
        }
      }
    };

    void loadMembers();

    return () => {
      isActive = false;
    };
  }, [workspaceId]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "channelType" && value !== "direct") {
      setSelectedDirectUserId("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (formData.channelType === "direct" && !selectedDirectUserId) {
      setLoading(false);
      setError("Select a workspace member for the direct channel.");
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          directUserId:
            formData.channelType === "direct"
              ? Number.parseInt(selectedDirectUserId, 10)
              : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create channel");
      }

      const channel = await response.json();
      toast.success("Channel created successfully!");
      onClose();

      if (onChannelCreated) {
        onChannelCreated(channel.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-lg dark:border-stroke-dark dark:bg-gray-dark">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-dark dark:text-white">
            Create Channel
          </h2>
          <button
            onClick={onClose}
            className="text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Channel Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., announcements"
              disabled={loading}
              className="w-full rounded-lg border border-stroke bg-white px-4 py-2 text-dark placeholder-dark-4 outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:placeholder-dark-6"
              required
            />
            <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
              Lowercase letters, numbers, hyphens, and underscores only
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Channel Type
            </label>
            <select
              name="channelType"
              value={formData.channelType}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full rounded-lg border border-stroke bg-white px-4 py-2 text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="direct">Direct</option>
            </select>
            <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
              {formData.channelType === "direct"
                ? "Direct channels are only visible to you and one other workspace member"
                : "Public channels are visible to all workspace members"}
            </p>
          </div>

          {formData.channelType === "direct" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Direct Channel Member
              </label>
              <select
                value={selectedDirectUserId}
                onChange={(event) =>
                  setSelectedDirectUserId(event.target.value)
                }
                disabled={loading || membersLoading}
                className="w-full rounded-lg border border-stroke bg-white px-4 py-2 text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white"
              >
                <option value="">Select a workspace member</option>
                {workspaceMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname || member.username} ({member.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                {membersLoading
                  ? "Loading workspace members..."
                  : "This channel will only be visible to the two selected users."}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="What is this channel about?"
              disabled={loading}
              rows={3}
              className="w-full rounded-lg border border-stroke bg-white px-4 py-2 text-dark placeholder-dark-4 outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:placeholder-dark-6"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-stroke px-4 py-2 font-medium text-dark transition hover:bg-gray-2 disabled:opacity-50 dark:border-stroke-dark dark:text-white dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
