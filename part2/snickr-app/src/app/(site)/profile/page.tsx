import { Metadata } from "next";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import ProfileBox from "@/components/ProfileBox";
import SettingBoxes from "@/components/SettingBoxes";
import React from "react";

export const metadata: Metadata = {
  title: "Profile | My App",
  description: "Manage your profile information",
};

export default function ProfilePage() {
  return (
    <DefaultLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-heading-2 font-bold text-dark dark:text-white">
            My Profile
          </h1>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <ProfileBox />
          <div>
            <div className="mb-6 rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card px-7 py-6">
              <h2 className="text-heading-5 font-semibold text-dark dark:text-white">
                Profile Settings
              </h2>
              <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
                Manage your profile information and preferences
              </p>
            </div>
            <SettingBoxes />
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
