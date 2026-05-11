import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseId = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const checkAccess = async (channelId: number, userId: number, schema: "lower" | "upper") => {
  const t =
    schema === "lower"
      ? {
          channels: "channels",
          workspaceMembers: "workspace_members",
          channelMembers: "channel_members",
        }
      : {
          channels: '"Channels"',
          workspaceMembers: '"Workspace_Members"',
          channelMembers: '"Channel_Members"',
        };

  const result = await query(
    `
      SELECT
        c.channel_type AS "channelType",
        EXISTS (
          SELECT 1 FROM ${t.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id AND wm.user_id = $2
        ) AS "isWorkspaceMember",
        EXISTS (
          SELECT 1 FROM ${t.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id AND wm.user_id = $2 AND wm.is_owner = true
        ) AS "isWorkspaceOwner",
        EXISTS (
          SELECT 1 FROM ${t.channelMembers} cm
          WHERE cm.channel_id = $1 AND cm.user_id = $2
        ) AS "isChannelMember"
      FROM ${t.channels} c
      WHERE c.channel_id = $1
      LIMIT 1
    `,
    [channelId, userId],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as {
    channelType: string;
    isWorkspaceMember: boolean;
    isWorkspaceOwner: boolean;
    isChannelMember: boolean;
  };
};

const searchMessages = async (channelId: number, searchQuery: string, schema: "lower" | "upper") => {
  const t =
    schema === "lower"
      ? { messages: "messages", users: "users" }
      : { messages: '"Messages"', users: '"Users"' };

  const result = await query(
    `
      SELECT
        m.message_id AS id,
        m.body,
        m.posted_at  AS "postedAt",
        u.username   AS "senderName",
        u.nickname   AS "senderNickname",
        u.image      AS "senderImage"
      FROM ${t.messages} m
      LEFT JOIN ${t.users} u ON u.user_id = m.sender_id
      WHERE m.channel_id = $1
        AND m.body ILIKE '%' || $2 || '%'
      ORDER BY m.posted_at DESC
      LIMIT 50
    `,
    [channelId, searchQuery],
  );

  return result.rows as Array<{
    id: number;
    body: string;
    postedAt: string;
    senderName: string | null;
    senderNickname: string | null;
    senderImage: string | null;
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId: channelIdParam } = await context.params;
    const channelId = parseId(channelIdParam);
    if (channelId === null) {
      return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!q) return NextResponse.json([]);

    // Verify access before searching
    let access = null;
    try {
      access = await checkAccess(channelId, userId, "lower");
    } catch (err: any) {
      if (err?.code !== "42P01") throw err;
    }
    if (!access) {
      try {
        access = await checkAccess(channelId, userId, "upper");
      } catch (err: any) {
        if (err?.code !== "42P01") throw err;
      }
    }

    if (!access) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (!access.isWorkspaceMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const isPrivate = access.channelType.toLowerCase() === "private";
    if (isPrivate && !access.isChannelMember && !access.isWorkspaceOwner) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let results = null;
    try {
      results = await searchMessages(channelId, q, "lower");
    } catch (err: any) {
      if (err?.code !== "42P01") throw err;
    }
    if (results === null) {
      try {
        results = await searchMessages(channelId, q, "upper");
      } catch (err: any) {
        if (err?.code !== "42P01") throw err;
      }
    }

    return NextResponse.json(results ?? []);
  } catch (error) {
    console.error("CHANNEL SEARCH ERROR:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
