"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import ProfileBox from "@/components/ProfileBox";
import SettingBoxes from "@/components/SettingBoxes";
import CreateWorkspaceCard from "@/components/CreateWorkspaceCard";
import { useWorkspace } from "@/context/WorkspaceContext";
import React from "react";

function ProfileContent() {
  const { showCreateCard } = useWorkspace();
  const [file, setFile] = useState<File | undefined>();
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const searchParams = useSearchParams();
  const returnChannel = searchParams.get("returnChannel");
  const returnWorkspace = searchParams.get("returnWorkspace");

  if (showCreateCard) {
    return (
      <div className="w-full">
        <CreateWorkspaceCard />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        {returnChannel && (
          <Link
            href={`/?channel=${returnChannel}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            ← Back to Channel
          </Link>
        )}
        {returnWorkspace && !returnChannel && (
          <Link
            href={`/?workspace=${returnWorkspace}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            ← Back to Workspace
          </Link>
        )}
        <h1 className="text-heading-2 font-bold text-dark dark:text-white">
          My Profile
        </h1>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <ProfileBox
          onProfileFileChange={setFile}
          onCoverFileChange={setCoverFile}
        />

        <div>
          <div className="mb-6 rounded-[10px] border border-stroke bg-white px-7 py-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
            <h2 className="text-heading-5 font-semibold text-dark dark:text-white">
              Profile Settings
            </h2>

            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              Manage your profile information and preferences
            </p>
          </div>

          <SettingBoxes
            file={file}
            coverFile={coverFile}
            returnChannel={returnChannel}
            returnWorkspace={returnWorkspace}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <DefaultLayout>
      <ProfileContent />
    </DefaultLayout>
  );
}
