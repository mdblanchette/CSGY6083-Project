import { NextResponse } from "next/server";
import { getAuthSession } from "@/libs/auth";
import { query } from "@/libs/db";
import { getVisibleWorkspaceChannels } from "@/libs/channel-access";

export const runtime = "nodejs";

type WorkspaceSummary = {
  currentUserId: number;
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

const getTables = (schema: "lower" | "upper") => {
  return schema === "lower"
    ? {
        workspaces: "workspaces",
        workspaceMembers: "workspace_members",
        users: "users",
      }
    : {
        workspaces: '"Workspaces"',
        workspaceMembers: '"Workspace_Members"',
        users: '"Users"',
      };
};

const buildSummary = async (
  workspaceId: number,
  userId: number,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

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

  const memberResult = await query(
    `
      SELECT 1
      FROM ${tables.workspaceMembers}
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId],
  );

  if (memberResult.rows.length === 0) {
    return { status: "forbidden" as const };
  }

  const channelsResult = await getVisibleWorkspaceChannels(
    workspaceId,
    userId,
    schema,
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
    currentUserId: userId,
    workspace: workspaceResult.rows[0],
    channels: channelsResult,
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

    const userId = Number.parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let summary = null;

    try {
      summary = await buildSummary(workspaceId, userId, "lower");
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!summary) {
      try {
        summary = await buildSummary(workspaceId, userId, "upper");
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }
      }
    }

    if (summary && "status" in summary && summary.status === "forbidden") {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
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
