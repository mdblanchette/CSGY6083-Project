import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

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
    isOwner: boolean;
    joinedAt: string;
  }>;
};

const parseWorkspaceId = (value: string) => {
  const workspaceId = Number.parseInt(value, 10);
  return Number.isFinite(workspaceId) ? workspaceId : null;
};

const buildSummary = async (
  workspaceId: number,
  userId: number,
  schema: "lower" | "upper",
): Promise<WorkspaceSummary | { forbidden: true } | null> => {
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

  const membershipResult = await query(
    `
      SELECT 1
      FROM ${tables.workspaceMembers} wm
      WHERE wm.workspace_id = $1
        AND wm.user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId],
  );

  if (membershipResult.rows.length === 0) {
    return { forbidden: true };
  }

  const channelsResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.name,
        c.channel_type AS type,
        c.description,
        c.created_at AS "createdAt",
        CASE
          WHEN LOWER(c.channel_type) = 'public' THEN (
            SELECT COUNT(*)::int
            FROM ${tables.workspaceMembers} wm
            WHERE wm.workspace_id = c.workspace_id
          )
          ELSE (
            SELECT COUNT(*)::int
            FROM ${tables.channelMembers} cm
            WHERE cm.channel_id = c.channel_id
          )
        END AS "memberCount",
        (
          SELECT COUNT(*)::int
          FROM ${tables.messages} m
          WHERE m.channel_id = c.channel_id
        ) AS "messageCount"
      FROM ${tables.channels} c
      WHERE c.workspace_id = $1
        AND (
          LOWER(c.channel_type) = 'public'
          OR EXISTS (
            SELECT 1
            FROM ${tables.channelMembers} cm
            WHERE cm.channel_id = c.channel_id
              AND cm.user_id = $2
          )
        )
      ORDER BY c.created_at ASC
    `,
    [workspaceId, userId],
  );

  const membersResult = await query(
    `
      SELECT
        u.user_id AS id,
        u.email,
        u.username,
        u.nickname,
        wm.is_admin AS "isAdmin",
        wm.is_owner AS "isOwner",
        wm.joined_at AS "joinedAt"
      FROM ${tables.workspaceMembers} wm
      INNER JOIN ${tables.users} u
        ON u.user_id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY wm.is_owner DESC, wm.is_admin DESC, wm.joined_at ASC
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

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    let summary = null;
    let forbidden = false;

    try {
      const result = await buildSummary(workspaceId, userId, "lower");
      if (result && "forbidden" in result) {
        forbidden = true;
      } else {
        summary = result;
      }
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!summary && !forbidden) {
      try {
        const result = await buildSummary(workspaceId, userId, "upper");
        if (result && "forbidden" in result) {
          forbidden = true;
        } else {
          summary = result;
        }
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }
      }
    }

    if (forbidden && !summary) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
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
