import { Metadata } from "next";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import React from "react";
import HomeWorkspaceView from "@/components/HomeWorkspaceView";

export const metadata: Metadata = {
  title: "Home | My App",
  description: "Welcome to my application",
};

export default function Home() {
  return (
    <>
      <DefaultLayout>
        <HomeWorkspaceView />
      </DefaultLayout>
    </>
  );
}
