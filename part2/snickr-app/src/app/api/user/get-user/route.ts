import { prisma } from "@/libs/prismaDb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const username = searchParams.get("username");
	const email = searchParams.get("email");

	if (!username && !email) {
		return new NextResponse("Email or username is required", { status: 400 });
	}

	try {
		const user = await prisma.user.findUnique({
			where: username
				? { username }
				: { email: email?.toLowerCase() },
		});

		if (!user) {
			return new NextResponse("User not found", { status: 404 });
		}

		const responseBody = {
			user_id: Number(user.id),
			email: user.email,
			username: user.username,
			nickname: user.nickname,
			bio: user.bio,
			status_text: user.statusText,
			status_emoji: user.statusEmoji,
			last_active: user.lastActive,
			created_at: user.createdAt,
		};

		return new NextResponse(JSON.stringify(responseBody), { status: 200 });
	} catch (error) {
		return new NextResponse("Something went wrong", { status: 500 });
	}
}