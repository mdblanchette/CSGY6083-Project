import { prisma } from "@/libs/prismaDb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/auth";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const body = await request.json();
 // const { email, nickname, username, status_text, bio } = body;
 const { email, nickname, username, status_emoji, status_text, bio } = body;

  const session = await getServerSession(authOptions);
  const updateData: { [key: string]: any } = {};

  const isDemo = session?.user?.email?.includes("demo-");

  if (!session?.user) {
    return new NextResponse(JSON.stringify("User not found!"), { status: 400 });
  }

  if (body === null) {
    return new NextResponse(JSON.stringify("Missing Fields"), { status: 400 });
  }

  if (nickname !== undefined) {
    updateData.nickname = nickname;
  }

  if (email) {
    updateData.email = email.toLowerCase();
  }

  if (username !== undefined) {
    updateData.username = username;
  }

  if (status_emoji !== undefined) {
    updateData.status_emoji = status_emoji;
  }

  if (status_text !== undefined) {
    updateData.status_text = status_text;
  }

  if (bio !== undefined) {
    updateData.bio = bio;
  }

  //updateData.last_active = new Date();

  if (isDemo) {
    return new NextResponse(JSON.stringify("Can't update demo user"), {
      status: 401,
    });
  }

  try {
    const user = await prisma.user.update({
      where: {
        email: session?.user?.email as string,
      },
      data: {
        ...updateData,
        last_active: new Date(),
      },
    });

    revalidatePath("/profile");

    return NextResponse.json(
  {
    email: user.email,
    nickname: user.nickname,
    username: user.username,
    status_emoji: user.status_emoji,
    status_text: user.status_text,
    bio: user.bio,
    last_active: user.last_active,
    created_at: user.created_at,
  },
  { status: 200 },
);

    // return new NextResponse(JSON.stringify("User Updated Successfully!"), {
    // 	status: 200,
    // });
  } catch (error) {
  console.error("PROFILE UPDATE ERROR:", error);
  return NextResponse.json(
    { error: String(error) },
    { status: 500 }
  );
}
}
