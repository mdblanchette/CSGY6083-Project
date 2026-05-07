import { query } from "@/libs/db";

type UserRecord = {
  user_id: number;
  email: string;
  username: string;
  nickname: string | null;
  password_hash: string;
  status_text: string | null;
  status_emoji: string | null;
  bio: string | null;
  last_active: Date | null;
  timezone: string | null;
  created_at: Date;
};

type PrismaLikeUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  coverImage: string | null;
  password: string | null;
  passwordResetToken: string | null;
  passwordResetTokenExp: Date | null;
  role: string | null;
  createdAt: Date;
  username?: string | null;
  nickname?: string | null;
  statusText?: string | null;
  statusEmoji?: string | null;
  bio?: string | null;
  lastActive?: Date | null;
  timezone?: string | null;
};

const toUser = (row: UserRecord): PrismaLikeUser => ({
  id: String(row.user_id),
  name: row.username,
  email: row.email,
  emailVerified: null,
  image: null,
  coverImage: null,
  password: row.password_hash,
  passwordResetToken: null,
  passwordResetTokenExp: null,
  role: "USER",
  createdAt: row.created_at,
  username: row.username,
  nickname: row.nickname,
  statusText: row.status_text,
  statusEmoji: row.status_emoji,
  bio: row.bio,
  lastActive: row.last_active,
  timezone: row.timezone,
});

const getUserBy = async (where: Record<string, unknown>) => {
  if (typeof where.email === "string") {
    const result = await query("SELECT * FROM users WHERE email = $1 LIMIT 1", [
      where.email.toLowerCase(),
    ]);
    return (
      result.rows[0] ? toUser(result.rows[0] as UserRecord) : null
    ) as PrismaLikeUser | null;
  }

  if (typeof where.user_id === "number") {
    const result = await query(
      "SELECT * FROM users WHERE user_id = $1 LIMIT 1",
      [where.user_id],
    );
    return (
      result.rows[0] ? toUser(result.rows[0] as UserRecord) : null
    ) as PrismaLikeUser | null;
  }

  if (typeof where.id === "string") {
    const result = await query(
      "SELECT * FROM users WHERE user_id = $1 LIMIT 1",
      [Number(where.id)],
    );
    return (
      result.rows[0] ? toUser(result.rows[0] as UserRecord) : null
    ) as PrismaLikeUser | null;
  }

  if (typeof where.passwordResetToken === "string") {
    return null;
  }

  return null;
};

const userApi = {
  async findUnique({ where }: { where: Record<string, unknown> }) {
    return getUserBy(where);
  },
  async findMany() {
    const result = await query("SELECT * FROM users ORDER BY created_at DESC");
    return result.rows.map((row) => toUser(row as UserRecord));
  },
  async create({ data }: { data: Record<string, unknown> }) {
    const email =
      typeof data.email === "string" ? data.email.toLowerCase() : null;
    const username =
      typeof data.username === "string"
        ? data.username
        : typeof data.name === "string"
          ? data.name
          : email?.split("@")[0] ?? "user";
    const passwordHash =
      typeof data.password_hash === "string"
        ? data.password_hash
        : typeof data.password === "string"
          ? data.password
          : "";

    if (!email || !passwordHash) {
      throw new Error("Missing required user fields");
    }

    const result = await query(
      `
        INSERT INTO users (
          email,
          username,
          nickname,
          password_hash,
          status_text,
          status_emoji,
          bio,
          timezone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        email,
        username,
        typeof data.nickname === "string" ? data.nickname : null,
        passwordHash,
        typeof data.status_text === "string" ? data.status_text : "",
        typeof data.status_emoji === "string" ? data.status_emoji : "",
        typeof data.bio === "string" ? data.bio : "",
        typeof data.timezone === "string" ? data.timezone : "",
      ],
    );

    return toUser(result.rows[0] as UserRecord);
  },
  async update({
    where,
    data,
  }: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) {
    const current = await getUserBy(where);
    if (!current) {
      throw new Error("User not found");
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      updates.push(`${sql} = $${values.length}`);
    };

    if (typeof data.email === "string") add("email", data.email.toLowerCase());
    if (typeof data.name === "string") add("username", data.name);
    if (typeof data.username === "string") add("username", data.username);
    if (typeof data.nickname === "string") add("nickname", data.nickname);
    if (typeof data.password === "string") add("password_hash", data.password);
    if (typeof data.password_hash === "string")
      add("password_hash", data.password_hash);
    if (typeof data.status_text === "string")
      add("status_text", data.status_text);
    if (typeof data.status_emoji === "string")
      add("status_emoji", data.status_emoji);
    if (typeof data.bio === "string") add("bio", data.bio);
    if (typeof data.timezone === "string") add("timezone", data.timezone);

    if (!updates.length) {
      return current;
    }

    values.push(Number(current.id));
    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${values.length} RETURNING *`,
      values,
    );

    return toUser(result.rows[0] as UserRecord);
  },
  async delete({ where }: { where: Record<string, unknown> }) {
    const current = await getUserBy(where);
    if (!current) {
      throw new Error("User not found");
    }

    await query("DELETE FROM users WHERE user_id = $1", [Number(current.id)]);
    return current;
  },
};

const apiKeyApi = {
  async findMany() {
    return [];
  },
  async create() {
    return null;
  },
  async delete() {
    return null;
  },
};

export const prisma: any = {
  user: userApi,
  apiKey: apiKeyApi,
};
