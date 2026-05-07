"use client";
import React, { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

const CreateWorkspaceCard = () => {
  const { showCreateCard, closeCreateCard } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!showCreateCard) return null;

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        // reload to pick up new workspace; in a real app, you'd update state instead
        window.location.reload();
      } else {
        console.error("Create failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Workspace</h3>
          <button onClick={closeCreateCard} className="text-muted">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Workspace Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={create}
              disabled={loading}
              className="rounded bg-primary px-4 py-2 text-white"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateWorkspaceCard;
