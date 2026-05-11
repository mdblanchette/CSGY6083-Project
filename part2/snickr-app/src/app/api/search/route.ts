import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

type SearchResult = {
  id: number;
  body: string;
  postedAt: string;
  channelId: number;
  channelName: string;
  channelType: string;
  workspaceId: number;
  workspaceName: string;
  senderName: string | null;
  senderNickname: string | null;
  senderImage: string | null;
};

const runSearch = async (userId: number, searchQuery: string, schema: "lower" | "upper") => {
  const t =
    schema === "lower"
      ? {
          workspaces: "workspaces",
          workspaceMembers: "workspace_members",
          channels: "channels",
          channelMembers: "channel_members",
          messages: "messages",
          users: "users",
        }
      : {
          workspaces: '"Workspaces"',
          workspaceMembers: '"Workspace_Members"',
          channels: '"Channels"',
          channelMembers: '"Channel_Members"',
          messages: '"Messages"',
          users: '"Users"',
        };

  const result = await query(
    `
      SELECT
        m.message_id   AS id,
        m.body,
        m.posted_at    AS "postedAt",
        c.channel_id   AS "channelId",
        c.name         AS "channelName",
        c.channel_type AS "channelType",
        w.workspace_id AS "workspaceId",
        w.name         AS "workspaceName",
        u.username     AS "senderName",
        u.nickname     AS "senderNickname",
        u.image        AS "senderImage"
      FROM ${t.messages} m
      JOIN  ${t.channels}   c ON c.channel_id   = m.channel_id
      JOIN  ${t.workspaces} w ON w.workspace_id = c.workspace_id
      LEFT JOIN ${t.users}  u ON u.user_id      = m.sender_id
      WHERE m.body ILIKE '%' || $1 || '%'
        -- caller must be a workspace member
        AND EXISTS (
          SELECT 1 FROM ${t.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id AND wm.user_id = $2
        )
        -- access: public channel, or explicit channel member
        AND (
          LOWER(c.channel_type) = 'public'
          OR EXISTS (
            SELECT 1 FROM ${t.channelMembers} cm
            WHERE cm.channel_id = c.channel_id AND cm.user_id = $2
          )
        )
      ORDER BY m.posted_at DESC
      LIMIT 50
    `,
    [searchQuery, userId],
  );

  return result.rows as SearchResult[];
};

export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!q) return NextResponse.json([]);

    let results: SearchResult[] | null = null;

    try {
      results = await runSearch(userId, q, "lower");
    } catch (err: any) {
      if (err?.code !== "42P01") throw err;
    }

    if (results === null) {
      try {
        results = await runSearch(userId, q, "upper");
      } catch (err: any) {
        if (err?.code !== "42P01") throw err;
      }
    }

    return NextResponse.json(results ?? []);
  } catch (error) {
    console.error("GLOBAL SEARCH ERROR:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
