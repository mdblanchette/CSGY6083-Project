"use client";
import React, { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

const CreateWorkspaceCard = () => {
  const {
    showCreateCard,
    closeCreateCard,
    refreshWorkspaces,
    selectWorkspace,
  } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!showCreateCard) return null;

const create = async () => {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (!trimmedName) {
    alert("Workspace name is required");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        description: trimmedDescription || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setName("");
      setDescription("");
      closeCreateCard();

      await refreshWorkspaces();

      if (data?.id) {
        selectWorkspace(data.id);
      }

      alert("Workspace created successfully");
    } else {
      alert(data.error || "Failed to create workspace");
      console.error("Create failed:", data);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to create workspace");
  } finally {
    setLoading(false);
  }
};

  return (
    <section className="w-full rounded-2xl border border-stroke bg-white p-5 shadow-sm dark:border-stroke-dark dark:bg-gray-dark md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Workspace setup</p>
          <h3 className="mt-1 text-xl font-semibold text-dark dark:text-white">
            Create Workspace
          </h3>
        </div>

        <button
          onClick={closeCreateCard}
          className="rounded-full border border-stroke px-3 py-1.5 text-sm font-medium text-dark-4 transition hover:border-primary hover:text-primary dark:border-stroke-dark dark:text-dark-6"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-1">
          <label className="block text-sm font-medium text-dark dark:text-white">
            Workspace Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 outline-none transition placeholder:text-dark-4 focus:border-primary dark:border-stroke-dark dark:text-white"
            placeholder="Product launch"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium text-dark dark:text-white">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-28 w-full rounded-xl border border-stroke bg-transparent px-4 py-3 outline-none transition placeholder:text-dark-4 focus:border-primary dark:border-stroke-dark dark:text-white"
            placeholder="What will this workspace be used for?"
          />
        </div>

        <div className="flex justify-end md:col-span-2">
          <button
            onClick={create}
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating..." : "Create Workspace"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default CreateWorkspaceCard;
