import { Metadata } from "next";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import React from "react";

export const metadata: Metadata = {
  title: "Home | My App",
  description: "Welcome to my application",
};

export default function Home() {
  return (
    <>
      <DefaultLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-heading-3 font-bold text-dark dark:text-white">
              No workspaces yet
            </h1>
            <p className="text-dark-4 dark:text-dark-6">
              Create a workspace to get started!
            </p>
          </div>
        </div>
      </DefaultLayout>
    </>
  );
}
