"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";

interface CreateChannelModalProps {
  workspaceId: number;
  onClose: () => void;
  onChannelCreated?: (channelId: number) => void;
}

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
            </select>
            <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
              Public channels are visible to all workspace members
            </p>
          </div>

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
