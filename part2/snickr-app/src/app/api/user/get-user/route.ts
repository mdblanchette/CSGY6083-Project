import { prisma } from "@/libs/prismaDb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const email = searchParams.get("email");

	if (!email) {
		return new NextResponse("Email is required", { status: 400 });
	}

	try {
		const user = await prisma.users.findUnique({
			where: {
				email: email.toLowerCase(),
			},
			select: {
				user_id: true,
				email: true,
				username: true,
				nickname: true,
				bio: true,
				status_text: true,
				last_active: true,
				created_at: true,
			},
		});

		if (!user) {
			return new NextResponse("User not found", { status: 404 });
		}

		return new NextResponse(JSON.stringify(user), { status: 200 });
	} catch (error) {
		return new NextResponse("Something went wrong", { status: 500 });
	}
}