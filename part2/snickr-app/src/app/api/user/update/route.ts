import { query } from "@/libs/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/auth";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json("User not found!", { status: 400 });
  }

  const isDemo = session.user.email.includes("demo-");
  if (isDemo) {
    return NextResponse.json("Can't update demo user", { status: 401 });
  }

  const body = await request.json();
  if (!body) {
    return NextResponse.json("Missing Fields", { status: 400 });
  }

  const { nickname, email, status_emoji, status_text, bio, image, coverImage } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, val: unknown) => {
    values.push(val);
    updates.push(`${col} = $${values.length}`);
  };

  if (nickname !== undefined) add("nickname", nickname);
  if (email !== undefined) add("email", (email as string).toLowerCase());
  if (status_emoji !== undefined) add("status_emoji", status_emoji);
  if (status_text !== undefined) add("status_text", status_text);
  if (bio !== undefined) add("bio", bio);
  if (image !== undefined) add("image", image);
  if (coverImage !== undefined) add("cover_image", coverImage);
  add("last_active", new Date());

  values.push(session.user.email);

  try {
    const result = await query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE email = $${values.length}
       RETURNING email, username, nickname, status_emoji, status_text, bio, image, cover_image, last_active, created_at`,
      values,
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    revalidatePath("/profile");

    return NextResponse.json({
      email: user.email,
      nickname: user.nickname,
      username: user.username,
      status_emoji: user.status_emoji,
      status_text: user.status_text,
      bio: user.bio,
      image: user.image,
      coverImage: user.cover_image,
      last_active: user.last_active,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
