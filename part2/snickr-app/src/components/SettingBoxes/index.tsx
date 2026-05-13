"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useSession } from "next-auth/react";

interface SettingsFormData {
  nickname: string;
  email: string;
  username: string;
  status_emoji: string;
  status_text: string;
  bio: string;
}

interface SettingBoxesProps {
  file?: File;
  coverFile?: File;
  returnChannel?: string;
  returnWorkspace?: string;
}

const SettingBoxes = ({
  file,
  coverFile,
  returnChannel,
  returnWorkspace,
}: SettingBoxesProps) => {
  const { data: session, update } = useSession();
  const sessionUser = session?.user as
    | {
        email?: string | null;
        username?: string | null;
        nickname?: string | null;
        status_emoji?: string | null;
        status_text?: string | null;
        bio?: string | null;
      }
    | undefined;

  const [data, setData] = useState<SettingsFormData>({
    nickname: sessionUser?.nickname ?? "",
    email: sessionUser?.email ?? "",
    username: sessionUser?.username ?? "",
    status_emoji: sessionUser?.status_emoji ?? "",
    status_text: sessionUser?.status_text ?? "",
    bio: sessionUser?.bio ?? "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { selectWorkspace } = useWorkspace();
  const isDemo = session?.user?.email?.includes("demo-");

  useEffect(() => {
    setData({
      nickname: sessionUser?.nickname ?? "",
      email: sessionUser?.email ?? "",
      username: sessionUser?.username ?? "",
      status_emoji: sessionUser?.status_emoji ?? "",
      status_text: sessionUser?.status_text ?? "",
      bio: sessionUser?.bio ?? "",
    });
  }, [
    sessionUser?.nickname,
    sessionUser?.email,
    sessionUser?.username,
    sessionUser?.status_emoji,
    sessionUser?.status_text,
    sessionUser?.bio,
  ]);

  const handleChange = (e: any) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const uploadPhoto = async (f: File, imageType: "profile" | "cover") => {
    const formData = new FormData();
    formData.append("file", f);
    formData.append("imageType", imageType);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error || "Failed to upload image");
      return null;
    }

    return json.key as string;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isDemo) {
      toast.error("Can't update demo user");
      return;
    }

    setLoading(true);

    let imageKey: string | null = null;
    let coverImageKey: string | null = null;

    if (file) imageKey = await uploadPhoto(file, "profile");
    if (coverFile) coverImageKey = await uploadPhoto(coverFile, "cover");

    const requestBody: any = {
      nickname: data.nickname,
      email: data.email,
      username: data.username,
      status_emoji: data.status_emoji,
      status_text: data.status_text,
      bio: data.bio,
    };

    if (imageKey) requestBody.image = imageKey;
    if (coverImageKey) requestBody.coverImage = coverImageKey;

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
      });

      const updatedUser = await res.json();

      if (res.status === 200) {
        toast.success("Profile updated successfully");
        await update({
          ...session,
          user: {
            ...session?.user,
            nickname: updatedUser.nickname,
            email: updatedUser.email,
            username: updatedUser.username,
            status_emoji: updatedUser.status_emoji,
            status_text: updatedUser.status_text,
            bio: updatedUser.bio,
            image: updatedUser.image,
            coverImage: updatedUser.coverImage,
          },
        });
      } else if (res.status === 401) {
        toast.error("Can't update demo user");
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error: any) {
      toast.error(error?.message || "Update failed");
    }

    setLoading(false);
  };

  return (
    <>
      <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="border-b border-stroke px-7 py-4 dark:border-dark-3">
          <h3 className="font-medium text-dark dark:text-white">
            Personal Information
          </h3>
        </div>
        <div className="p-7">
          <form onSubmit={handleSubmit}>
            <div className="mb-5.5 flex flex-col gap-5.5 sm:flex-row">
              <div className="w-full sm:w-1/2">
                <label
                  className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                  htmlFor="nickname"
                >
                  Nickname
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-[7px] border-[1.5px] border-stroke bg-white px-4.5 py-2.5 text-dark focus:border-primary focus-visible:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                    type="text"
                    name="nickname"
                    id="nickname"
                    placeholder="Enter your nickname"
                    value={data.nickname || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="w-full sm:w-1/2">
                <label
                  className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                  htmlFor="username"
                >
                  Username
                </label>
                <div className="relative">
                  <input
                    className="w-full cursor-not-allowed rounded-[7px] border-[1.5px] border-slate-300 bg-slate-100 px-4.5 py-2.5 text-slate-500 placeholder:text-slate-400 focus:border-primary focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:placeholder:text-slate-500 dark:focus:border-primary"
                    type="text"
                    name="username"
                    id="username"
                    placeholder="Username cannot be changed"
                    value={data.username || ""}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="mb-5.5">
              <label
                className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-[7px] border-[1.5px] border-stroke bg-white px-4.5 py-2.5 text-dark focus:border-primary focus-visible:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Enter your email"
                  value={data.email || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="mb-5.5">
              <label
                className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                htmlFor="status_emoji"
              >
                Status
              </label>
              <div className="relative">
                <select
                  className="w-full rounded-[7px] border-[1.5px] border-stroke bg-white px-4.5 py-2.5 text-dark focus:border-primary focus-visible:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                  name="status_emoji"
                  id="status_emoji"
                  value={data.status_emoji || ""}
                  onChange={handleChange}
                >
                  <option value="">Select Status</option>
                  <option value="🟢">Available</option>
                  <option value="🟡">Away</option>
                  <option value="🔴">Do Not Disturb</option>
                  <option value="⚫">Offline</option>
                </select>
              </div>
            </div>

            <div className="mb-5.5">
              <label
                className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                htmlFor="status_text"
              >
                Note
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-[7px] border-[1.5px] border-stroke bg-white px-4.5 py-2.5 text-dark focus:border-primary focus-visible:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                  type="text"
                  name="status_text"
                  id="status_text"
                  placeholder="e.g., In a meeting, Working from home"
                  value={data.status_text || ""}
                  onChange={handleChange}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="mb-5.5">
              <label
                className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
                htmlFor="bio"
              >
                Bio
              </label>
              <div className="relative">
                <textarea
                  className="w-full rounded-[7px] border-[1.5px] border-stroke bg-white px-4.5 py-5 text-dark focus:border-primary focus-visible:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                  name="bio"
                  id="bio"
                  rows={6}
                  placeholder="Write your bio here"
                  value={data.bio || ""}
                  onChange={handleChange}
                  maxLength={500}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="flex justify-center rounded-[7px] border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
                type="button"
                onClick={() => {
                  if (returnChannel) {
                    if (returnWorkspace) {
                      const id = Number.parseInt(returnWorkspace, 10);
                      if (Number.isFinite(id)) selectWorkspace(id);
                    }
                    router.push(
                      `/?channel=${returnChannel}${returnWorkspace ? `&workspace=${returnWorkspace}` : ""}`,
                    );
                    return;
                  }
                  if (returnWorkspace) {
                    const id = Number.parseInt(returnWorkspace, 10);
                    if (Number.isFinite(id)) selectWorkspace(id);
                    router.push(`/?workspace=${returnWorkspace}`);
                    return;
                  }
                  if (window.history.length > 1) {
                    router.back();
                    return;
                  }
                  router.push("/");
                }}
              >
                Cancel
              </button>
              <button
                className="flex justify-center rounded-[7px] bg-primary px-6 py-[7px] font-medium text-gray-2 hover:bg-opacity-90"
                type="submit"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    Saving{" "}
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-dark dark:border-t-transparent" />
                  </span>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default SettingBoxes;
