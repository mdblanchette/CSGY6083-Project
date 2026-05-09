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
    : "/images/user/user-03.png";

  const coverPic = session?.user?.coverImage
    ? session?.user?.coverImage.includes("http")
      ? session?.user?.coverImage
      : `${process.env.NEXT_PUBLIC_COVER_IMAGE_URL}/${session?.user?.coverImage}`
    : "/images/cover/cover-01.png";

  const [data, setData] = useState({
    name: (session?.user?.name as string) || "",
    email: session?.user?.email || "",
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
      setData((d) => ({ ...d, profilePhoto: "", coverPhoto: "" }));
      return null;
    }

    const url = signedUrl.success.url;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (res.status === 200) return signedUrl?.success?.key;
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
      const requestBody: any = { name: dataBody.name, email: dataBody.email };
      if (uploadedImageUrl) requestBody.image = uploadedImageUrl;
      if (uploadedCoverImageUrl) requestBody.coverImage = uploadedCoverImageUrl;

      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const updatedUser = await res.json();
      if (res.status === 200) {
        toast.success("Profile updated successfully");
        setLoading(false);
        return updatedUser;
      }
      if (res.status === 401) toast.error("Can't update demo user");
      else toast.error("Failed to update profile");
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
        user: { ...session?.user, ...updatedUser },
      });
      setData({ name: "", email: "", profilePhoto: "", coverPhoto: "" });
      window.location.reload();
    }
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
                d="M5.69882 3.365C5.89894 2.38259 6.77316 1.6875 7.77475 1.6875H10.2252C11.2268 1.6875 12.1011 2.38259 12.3012 3.36499C12.3474 3.59178 12.5528 3.75814 12.7665 3.75814H12.7788L12.7911 3.75868C13.8437 3.80471 14.6521 3.93387 15.3271 4.37668C15.7524 4.65568 16.1182 5.01463 16.4033 5.43348C16.7579 5.9546 16.9143 6.55271 16.9893 7.27609C17.0625 7.98284 17.0625 8.86875 17.0625 9.99079V10.0547C17.0625 11.1767 17.0625 12.0626 16.9893 12.7694C16.9143 13.4927 16.7579 14.0909 16.4033 14.612C16.1182 15.0308 15.7524 15.3898 15.3271 15.6688C14.7995 16.0149 14.1947 16.1675 13.461 16.2408C12.7428 16.3125 11.8418 16.3125 10.6976 16.3125H7.30242C6.15824 16.3125 5.25725 16.3125 4.53897 16.2408C3.80534 16.1675 3.20049 16.0149 2.67289 15.6688C2.24761 15.3898 1.88179 15.0308 1.59674 14.612C1.24209 14.0909 1.08567 13.4927 1.01072 12.7694C0.937488 12.0626 0.937494 11.1767 0.9375 10.0547V9.9908C0.937494 8.86875 0.937488 7.98284 1.01072 7.27609C1.08567 6.55271 1.24209 5.9546 1.59674 5.43348C1.88179 5.01463 2.24761 4.65568 2.67289 4.37668C3.34787 3.93387 4.15635 3.80471 5.20892 3.75868L5.2212 3.75814H5.2335C5.44716 3.75814 5.65262 3.59179 5.69882 3.365Z"
                fill=""
              />
            </svg>
          </label>
        </div>

        <div className="mt-4 text-left">
          <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
            {session?.user?.username ||
              session?.user?.nickname ||
              data?.name ||
              "User"}
          </h3>

          {(session?.user?.status_emoji || session?.user?.status_text) && (
            <p className="text-body mb-2 text-sm">
              {session?.user?.status_emoji} {session?.user?.status_text}
            </p>
          )}

          <div className="mx-auto max-w-[720px]">
            <p className="mt-2 text-sm">
              {session?.user?.bio || "No bio provided."}
            </p>
          </div>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-2 text-sm text-dark dark:text-white">
            <div>
              <strong className="font-medium">Email: </strong>
              <span className="ml-2 font-normal">
                {session?.user?.email || "—"}
              </span>
            </div>
            <div>
              <strong className="font-medium">Username: </strong>
              <span className="ml-2 font-normal">
                {session?.user?.username || session?.user?.nickname || "—"}
              </span>
            </div>
            <div>
              <strong className="font-medium">Last Active: </strong>
              <span className="ml-2 font-normal">
                {session?.user?.last_active
                  ? new Date(session.user.last_active).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div>
              <strong className="font-medium">Joined: </strong>
              <span className="ml-2 font-normal">
                {session?.user?.created_at
                  ? new Date(session.user.created_at).toLocaleDateString()
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
