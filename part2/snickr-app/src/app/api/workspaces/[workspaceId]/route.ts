import { NextResponse } from "next/server";
import { query } from "@/libs/db";

export const runtime = "nodejs";

type WorkspaceSummary = {
  workspace: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
  };
  channels: Array<{
    id: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    messageCount: number;
  }>;
  members: Array<{
    id: number;
    email: string;
    username: string;
    nickname: string | null;
    isAdmin: boolean;
    joinedAt: string;
  }>;
};

const parseWorkspaceId = (value: string) => {
  const workspaceId = Number.parseInt(value, 10);
  return Number.isFinite(workspaceId) ? workspaceId : null;
};

const buildSummary = async (workspaceId: number, schema: "lower" | "upper") => {
  const tables =
    schema === "lower"
      ? {
          workspaces: "workspaces",
          channels: "channels",
          workspaceMembers: "workspace_members",
          users: "users",
          channelMembers: "channel_members",
          messages: "messages",
        }
      : {
          workspaces: '"Workspaces"',
          channels: '"Channels"',
          workspaceMembers: '"Workspace_Members"',
          users: '"Users"',
          channelMembers: '"Channel_Members"',
          messages: '"Messages"',
        };

  const workspaceResult = await query(
    `
      SELECT
        workspace_id AS id,
        name,
        description,
        created_at AS "createdAt"
      FROM ${tables.workspaces}
      WHERE workspace_id = $1
      LIMIT 1
    `,
    [workspaceId],
  );

  if (workspaceResult.rows.length === 0) {
    return null;
  }

  const channelsResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.name,
        c.channel_type AS type,
        c.description,
        c.created_at AS "createdAt",
        (
          SELECT COUNT(*)::int
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
        ) AS "memberCount",
        (
          SELECT COUNT(*)::int
          FROM ${tables.messages} m
          WHERE m.channel_id = c.channel_id
        ) AS "messageCount"
      FROM ${tables.channels} c
      WHERE c.workspace_id = $1
      ORDER BY c.created_at ASC
    `,
    [workspaceId],
  );

  const membersResult = await query(
    `
      SELECT
        u.user_id AS id,
        u.email,
        u.username,
        u.nickname,
        wm.is_admin AS "isAdmin",
        wm.joined_at AS "joinedAt"
      FROM ${tables.workspaceMembers} wm
      INNER JOIN ${tables.users} u
        ON u.user_id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY wm.is_admin DESC, wm.joined_at ASC
    `,
    [workspaceId],
  );

  return {
    workspace: workspaceResult.rows[0],
    channels: channelsResult.rows,
    members: membersResult.rows,
  } as WorkspaceSummary;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: workspaceIdParam } = await context.params;
    const workspaceId = parseWorkspaceId(workspaceIdParam);

    if (workspaceId === null) {
      return NextResponse.json(
        { error: "Invalid workspace id" },
        { status: 400 },
      );
    }

    let summary = null;

    try {
      summary = await buildSummary(workspaceId, "lower");
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!summary) {
      try {
        summary = await buildSummary(workspaceId, "upper");
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }
      }
    }

    if (!summary) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch workspace summary" },
      { status: 500 },
    );
  }
}
