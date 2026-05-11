import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseId = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const searchMessages = async (
  workspaceId: number,
  userId: number,
  searchQuery: string,
  schema: "lower" | "upper",
) => {
  const t =
    schema === "lower"
      ? {
          workspaceMembers: "workspace_members",
          channelMembers: "channel_members",
          channels: "channels",
          messages: "messages",
          users: "users",
        }
      : {
          workspaceMembers: '"Workspace_Members"',
          channelMembers: '"Channel_Members"',
          channels: '"Channels"',
          messages: '"Messages"',
          users: '"Users"',
        };

  // Confirm caller is a workspace member
  const memberCheck = await query(
    `SELECT 1 FROM ${t.workspaceMembers} WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userId],
  );
  if (memberCheck.rows.length === 0) return { forbidden: true as const };

  const result = await query(
    `
      SELECT
        m.message_id  AS id,
        m.body,
        m.posted_at   AS "postedAt",
        c.channel_id  AS "channelId",
        c.name        AS "channelName",
        c.channel_type AS "channelType",
        u.username    AS "senderName",
        u.nickname    AS "senderNickname",
        u.image       AS "senderImage"
      FROM ${t.messages} m
      JOIN  ${t.channels} c ON c.channel_id = m.channel_id
      LEFT JOIN ${t.users} u ON u.user_id = m.sender_id
      WHERE c.workspace_id = $1
        AND m.body ILIKE '%' || $2 || '%'
        AND (
          -- public: all workspace members see it
          LOWER(c.channel_type) = 'public'
          -- private/direct: must be an explicit channel member
          OR EXISTS (
            SELECT 1 FROM ${t.channelMembers} cm
            WHERE cm.channel_id = c.channel_id AND cm.user_id = $3
          )
        )
      ORDER BY m.posted_at DESC
      LIMIT 50
    `,
    [workspaceId, searchQuery, userId],
  );

  return result.rows as Array<{
    id: number;
    body: string;
    postedAt: string;
    channelId: number;
    channelName: string;
    channelType: string;
    senderName: string | null;
    senderNickname: string | null;
    senderImage: string | null;
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: workspaceIdParam } = await context.params;
    const workspaceId = parseId(workspaceIdParam);
    if (workspaceId === null) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!q) return NextResponse.json([]);

    let result = null;

    try {
      result = await searchMessages(workspaceId, userId, q, "lower");
    } catch (err: any) {
      if (err?.code !== "42P01") throw err;
    }

    if (!result) {
      try {
        result = await searchMessages(workspaceId, userId, q, "upper");
      } catch (err: any) {
        if (err?.code !== "42P01") throw err;
      }
    }

    if (!result) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if ("forbidden" in result) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("WORKSPACE SEARCH ERROR:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
