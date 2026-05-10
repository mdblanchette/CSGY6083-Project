import Image from "next/image";

type ReadOnlyProfileBoxProps = {
  user: {
    email: string | null;
    username: string | null;
    nickname: string | null;
    bio: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    lastActive: string | null;
    createdAt: string | null;
    image?: string | null;
    coverImage?: string | null;
  };
};

const ReadOnlyProfileBox = ({ user }: ReadOnlyProfileBoxProps) => {
  const profilePic = user.image
    ? user.image.includes("http")
      ? user.image
      : `${process.env.NEXT_PUBLIC_IMAGE_URL}/${user.image}`
    : "/images/user/defaulticon.png";

  const coverPic = user.coverImage
    ? user.coverImage.includes("http")
      ? user.coverImage
      : `${process.env.NEXT_PUBLIC_COVER_IMAGE_URL}/${user.coverImage}`
    : "/images/cover/cover-01.png";

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="relative z-20 h-35 md:h-65">
        <Image
          src={coverPic}
          alt="profile cover"
          className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
          width={970}
          height={260}
        />
      </div>

      <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
        <div className="relative z-30 mx-auto -mt-22 h-30 w-full max-w-30 rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:max-w-[176px] sm:p-3">
          <div className="relative drop-shadow-2">
            <Image
              src={profilePic}
              width={160}
              height={160}
              className="overflow-hidden rounded-full"
              alt="profile"
            />
          </div>
        </div>

        <div className="mt-4 text-left">
          <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
            {user.nickname || user.username || user.email || "User"}
          </h3>

          {(user.statusEmoji || user.statusText) && (
            <p className="text-body mb-2 text-sm">
              {user.statusEmoji} {user.statusText}
            </p>
          )}

          <div className="mx-auto max-w-[720px]">
            <p className="mt-2 text-sm">
              {user.bio || "No bio provided."}
            </p>
          </div>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-2 text-sm text-dark dark:text-white">
            <div>
              <strong className="font-medium">Email: </strong>
              <span className="ml-2 font-normal">{user.email || "—"}</span>
            </div>

            <div>
              <strong className="font-medium">Username: </strong>
              <span className="ml-2 font-normal">
                {user.username || user.nickname || "—"}
              </span>
            </div>

            <div>
              <strong className="font-medium">Last Active: </strong>
              <span className="ml-2 font-normal">
                {user.lastActive
                  ? new Date(user.lastActive).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div>
              <strong className="font-medium">Joined: </strong>
              <span className="ml-2 font-normal">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadOnlyProfileBox;
