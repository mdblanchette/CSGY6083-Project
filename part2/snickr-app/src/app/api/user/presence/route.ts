import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/auth";
import { query } from "@/libs/db";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  if (session.user.email.includes("demo-")) {
    return NextResponse.json(
      { error: "Can't update demo user" },
      { status: 401 },
    );
  }

  try {
    await query(
      `
        UPDATE users
        SET last_active = $1
        WHERE email = $2
      `,
      [new Date(), session.user.email],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PRESENCE UPDATE ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
