"use client";

import React from "react";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { getSignedURL } from "@/actions/upload";

const ProfileBox = () => {
  const { data: session, update } = useSession();

  const profilePic = session?.user?.image
    ? session?.user?.image.includes("http")
      ? session?.user?.image
      : `${process.env.NEXT_PUBLIC_IMAGE_URL}/${session?.user?.image}`
    : "/images/user/defaulticon.png";

  const coverPic = session?.user?.coverImage
    ? session?.user?.coverImage.includes("http")
      ? session?.user?.coverImage
      : `${process.env.NEXT_PUBLIC_COVER_IMAGE_URL}/${session?.user?.coverImage}`
    : "/images/cover/cover-01.png";

  const [data, setData] = useState({
    name: (session?.user?.name as string) || "",
    email: session?.user?.email || "",
    username: session?.user?.username || "",
    nickname: session?.user?.nickname || "",
    status_emoji: session?.user?.status_emoji || "",
    status_text: session?.user?.status_text || "",
    bio: session?.user?.bio || "",
    last_active: session?.user?.last_active || "",
    created_at: session?.user?.created_at || "",
    profilePhoto: profilePic,
    coverPhoto: coverPic,
  });

  const [file, setFile] = useState<File | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const isDemo = session?.user?.email?.includes("demo-");

  const handleChange = (e: any) => {
    if (e.target.name === "profilePhoto") {
      const f = e.target?.files?.[0];
      setData((d) => ({
        ...d,
        profilePhoto: f ? URL.createObjectURL(f) : d.profilePhoto,
      }));
      setFile(f);
      return;
    }

    if (e.target.name === "coverPhoto") {
      const f = e.target?.files?.[0];
      setData((d) => ({
        ...d,
        coverPhoto: f ? URL.createObjectURL(f) : d.coverPhoto,
      }));
      setFile(f);
      return;
    }

    setData((d) => ({ ...d, [e.target.name]: e.target.value }));
  };

  const handleFileUpload = async (file: any) => {
    if (!file) return null;

    const signedUrl = await getSignedURL(file.type, file.size);

    if (signedUrl.failure !== undefined) {
      toast.error(signedUrl.failure);

      setFile(undefined);

      setData((d) => ({
        ...d,
        profilePhoto: "",
        coverPhoto: "",
      }));

      return null;
    }

    const url = signedUrl.success.url;

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (res.status === 200) {
        return signedUrl?.success?.key;
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload profile photo");
    }

    return null;
  };

  const updateUserProfile = async (
    dataBody: any,
    uploadedImageUrl?: string,
    uploadedCoverImageUrl?: string,
  ) => {
    try {
      const requestBody: any = {
        name: dataBody.name,
        email: dataBody.email,
        username: dataBody.username,
        nickname: dataBody.nickname,
        status_emoji: dataBody.status_emoji,
        status_text: dataBody.status_text,
        bio: dataBody.bio,
      };

      if (uploadedImageUrl) requestBody.image = uploadedImageUrl;
      if (uploadedCoverImageUrl)
        requestBody.coverImage = uploadedCoverImageUrl;

      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const updatedUser = await res.json();

      if (res.status === 200) {
        toast.success("Profile updated successfully");
        setLoading(false);
        return updatedUser;
      }

      if (res.status === 401) {
        toast.error("Can't update demo user");
      } else {
        toast.error("Failed to update profile");
      }
    } catch (err: any) {
      toast.error(err?.message || "Update failed");
    }

    setLoading(false);
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isDemo) {
      toast.error("Can't update demo user");
      return;
    }

    setLoading(true);

    const uploadedImageUrl = await handleFileUpload(file);
    const uploadedCoverImageUrl = await handleFileUpload(file);

    const updatedUser = await updateUserProfile(
      data,
      uploadedImageUrl as string,
      uploadedCoverImageUrl as string,
    );

    if (updatedUser) {
      await update({
        ...session,
        user: {
          ...session?.user,
          ...updatedUser,
        },
      });

      setData((prev) => ({
        ...prev,
        ...updatedUser,
      }));
    }

    setLoading(false);
  };

  return (
    <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="relative z-20 h-35 md:h-65">
        <Image
          src={data?.coverPhoto || coverPic}
          alt="profile cover"
          className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
          width={970}
          height={260}
        />

        <div className="absolute bottom-1 right-1 z-10 xsm:bottom-4 xsm:right-4">
          <label
            htmlFor="coverPhoto"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-[3px] bg-primary px-[15px] py-[5px] text-body-sm font-medium text-white hover:bg-opacity-90"
          >
            <input
              type="file"
              name="coverPhoto"
              id="coverPhoto"
              className="sr-only"
              onChange={handleChange}
              accept="image/png, image/jpg, image/jpeg"
            />
            <span>Edit</span>
          </label>
        </div>
      </div>

      <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
        <div className="relative z-30 mx-auto -mt-22 h-30 w-full max-w-30 rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:max-w-[176px] sm:p-3">
          <div className="relative drop-shadow-2">
            <Image
              src={data?.profilePhoto || profilePic}
              width={160}
              height={160}
              className="overflow-hidden rounded-full"
              alt="profile"
            />
          </div>

          <label
            htmlFor="profilePhoto"
            className="absolute bottom-0 right-0 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full bg-primary text-white hover:bg-opacity-90 sm:bottom-2 sm:right-2"
          >
            <input
              type="file"
              name="profilePhoto"
              id="profilePhoto"
              className="sr-only"
              onChange={handleChange}
              accept="image/png, image/jpg, image/jpeg"
            />
            <span className="hidden">Upload</span>
           <svg
           className="fill-current"
           width="18"
           height="18"
           viewBox="0 0 18 18"
           fill="none"
           xmlns="http://www.w3.org/2000/svg"
           >
            <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5.69882 3.365C5.89894 2.38259 6.77316 1.6875 7.77475 1.6875H10.2252C11.2268 1.6875 12.1011 2.38259 12.3012 3.36499C12.3474 3.59178 12.5528 3.75814 12.7665 3.75814H12.7788L12.7911 3.75868C13.8437 3.80471 14.6521 3.93387 15.3271 4.37668C15.7524 4.65568 16.1182 5.01463 16.4033 5.43348C16.7579 5.9546 16.9143 6.55271 16.9893 7.27609C17.0625 7.98284 17.0625 8.86875 17.0625 9.99079V10.0547C17.0625 11.1767 17.0625 12.0626 16.9893 12.7694C16.9143 13.4927 16.7579 14.0909 16.4033 14.612C16.1182 15.0308 15.7524 15.3898 15.3271 15.6688C14.6521 16.1116 13.8437 16.2408 12.7911 16.2868L12.7788 16.2873H12.7665C12.5528 16.2873 12.3474 16.4537 12.3012 16.6805C12.1011 17.6629 11.2268 18.358 10.2252 18.358H7.77475C6.77316 18.358 5.89894 17.6629 5.69882 16.6805C5.65263 16.4537 5.44719 16.2873 5.23353 16.2873H5.22116L5.20886 16.2868C4.15631 16.2408 3.34792 16.1116 2.67292 15.6688C2.24757 15.3898 1.8818 15.0308 1.59672 14.612C1.24207 14.0909 1.08569 13.4927 1.01066 12.7694C0.9375 12.0626 0.9375 11.1767 0.9375 10.0547V9.99079C0.9375 8.86875 0.9375 7.98284 1.01066 7.27609C1.08569 6.55271 1.24207 5.9546 1.59672 5.43348C1.8818 5.01463 2.24757 4.65568 2.67292 4.37668C3.34792 3.93387 4.15631 3.80471 5.20886 3.75868L5.22116 3.75814H5.23353C5.44719 3.75814 5.65263 3.59178 5.69882 3.365ZM9 13.125C10.8639 13.125 12.375 11.6139 12.375 9.75C12.375 7.88604 10.8639 6.375 9 6.375C7.13604 6.375 5.625 7.88604 5.625 9.75C5.625 11.6139 7.13604 13.125 9 13.125Z"
            fill=""
            />
            </svg>
            </label>
        </div>

        <div className="mt-4 text-left">
          <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
            {data.nickname || data.username || data.name || "User"}
          </h3>

          {(data.status_emoji || data.status_text) && (
            <p className="text-body mb-2 text-sm">
              {data.status_emoji} {data.status_text}
            </p>
          )}

          <div className="mx-auto max-w-[720px]">
            <p className="mt-2 text-sm">
              {data.bio || "No bio provided."}
            </p>
          </div>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-2 text-sm text-dark dark:text-white">
            <div>
              <strong className="font-medium">Email: </strong>
              <span className="ml-2 font-normal">
                {data.email || "—"}
              </span>
            </div>

            <div>
              <strong className="font-medium">Username: </strong>
              <span className="ml-2 font-normal">
                {data.username || data.nickname || "—"}
              </span>
            </div>

            <div>
              <strong className="font-medium">Last Active: </strong>
              <span className="ml-2 font-normal">
                {data.last_active
                  ? new Date(data.last_active).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div>
              <strong className="font-medium">Joined: </strong>
              <span className="ml-2 font-normal">
                {data.created_at
                  ? new Date(data.created_at).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileBox;