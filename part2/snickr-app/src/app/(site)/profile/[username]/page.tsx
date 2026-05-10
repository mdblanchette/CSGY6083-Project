import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import ReadOnlyProfileBox from "@/components/ProfileBox/ReadOnlyProfileBox";
import { query } from "@/libs/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/auth";

type UserProfile = {
  id: number;
  email: string | null;
  username: string | null;
  nickname: string | null;
  bio: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  lastActive: string | null;
  createdAt: string | null;
  image: string | null;
  coverImage: string | null;
};

export const metadata: Metadata = {
  title: "User Profile | Snickr",
  description: "View a user's profile on Snickr.",
};

const parseId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getUserByIdentifier = async (identifier: string) => {
  const userId = parseId(identifier);
  const queryText = userId
    ? `
      SELECT
        user_id AS "id",
        email,
        username,
        nickname,
        bio,
        status_text AS "statusText",
        status_emoji AS "statusEmoji",
        last_active AS "lastActive",
        created_at AS "createdAt",
        image,
        cover_image AS "coverImage"
      FROM users
      WHERE username = $1 OR user_id = $2
      LIMIT 1
    `
    : `
      SELECT
        user_id AS "id",
        email,
        username,
        nickname,
        bio,
        status_text AS "statusText",
        status_emoji AS "statusEmoji",
        last_active AS "lastActive",
        created_at AS "createdAt",
        image,
        cover_image AS "coverImage"
      FROM users
      WHERE username = $1
      LIMIT 1
    `;

  const params = userId ? [identifier, userId] : [identifier];
  const result = await query(queryText, params);
  return result.rows[0] as UserProfile | undefined;
};

export default async function ProfileViewPage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.username === params.username) {
    redirect("/profile");
  }

  const user = await getUserByIdentifier(params.username);

  if (!user) {
    notFound();
  }

  return (
    <DefaultLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-heading-2 font-bold text-dark dark:text-white">
            {user.username || user.nickname || user.email}'s Profile
          </h1>
        </div>

        <ReadOnlyProfileBox user={user} />
      </div>
    </DefaultLayout>
  );
}
