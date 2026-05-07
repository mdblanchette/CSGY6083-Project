import { Metadata } from "next";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import SettingBoxes from "@/components/SettingBoxes";
import React from "react";

export const metadata: Metadata = {
  title: "Profile | My App",
  description: "Manage your profile information",
};

export default function ProfilePage() {
  return (
    <>
      <DefaultLayout>
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-heading-2 font-bold text-dark dark:text-white">
              Profile Settings
            </h1>
            <p className="mt-2 text-dark-4 dark:text-dark-6">
              Manage your profile information and preferences
            </p>
          </div>
          <SettingBoxes />
        </div>
      </DefaultLayout>
    </>
  );
}
