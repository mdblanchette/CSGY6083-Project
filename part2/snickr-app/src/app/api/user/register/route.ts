import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { query } from "@/libs/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { username, email, password, reEnterPassword } = body;

  if (!username || !email || !password || !reEnterPassword) {
    return new NextResponse("Missing Fields", { status: 400 });
  }

  if (password !== reEnterPassword) {
    return new NextResponse("Passwords do not match", { status: 400 });
  }

  const formatedEmail = email.toLowerCase();
  const formattedUsername = String(username).trim().toLowerCase();

  const exist = await query(
    `SELECT 1 FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
    [formatedEmail, formattedUsername],
  );

  if (exist.rowCount) {
    return new NextResponse("User already exists", { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await query(
      `
				INSERT INTO users (email, username, password_hash)
				VALUES ($1, $2, $3)
				RETURNING user_id, email, username, created_at
			`,
      [formatedEmail, formattedUsername, hashedPassword],
    );

    return NextResponse.json(user.rows[0]);
  } catch (error) {
    return new NextResponse("Something went wrong", { status: 500 });
  }
}
