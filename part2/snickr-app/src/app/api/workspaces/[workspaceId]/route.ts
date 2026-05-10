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
            (SELECT COUNT(*)::int FROM ${tables.channelMembers} cm WHERE cm.channel_id = c.channel_id)
            + (SELECT COUNT(*)::int FROM ${tables.workspaceMembers} wm_o
               WHERE wm_o.workspace_id = c.workspace_id
                 AND wm_o.is_owner = true
                 AND NOT EXISTS (
                   SELECT 1 FROM ${tables.channelMembers} cm2
                   WHERE cm2.channel_id = c.channel_id AND cm2.user_id = wm_o.user_id
                 ))
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
          OR EXISTS (
            SELECT 1
            FROM ${tables.workspaceMembers} wm_owner
            WHERE wm_owner.workspace_id = c.workspace_id
              AND wm_owner.user_id = $2
              AND wm_owner.is_owner = true
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

// PATCH — workspace admin or owner renames the workspace
export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: workspaceIdParam } = await context.params;
    const workspaceId = parseWorkspaceId(workspaceIdParam);
    if (workspaceId === null) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name.trim() : undefined;
    const newDescription: string | null | undefined =
      "description" in body
        ? body.description === null
          ? null
          : typeof body.description === "string"
          ? body.description.trim()
          : undefined
        : undefined;

    if (rawName === "") {
      return NextResponse.json({ error: "Workspace name cannot be empty" }, { status: 400 });
    }
    if (rawName === undefined && newDescription === undefined) {
      return NextResponse.json({ error: "Provide name or description to update" }, { status: 400 });
    }

    const memberRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, userId],
    );
    if (memberRow.rows.length === 0 || (!memberRow.rows[0].is_admin && !memberRow.rows[0].is_owner)) {
      return NextResponse.json({ error: "Only workspace admins can update the workspace" }, { status: 403 });
    }

    if (rawName) {
      await query(`UPDATE workspaces SET name = $1 WHERE workspace_id = $2`, [rawName, workspaceId]);
    }
    if (newDescription !== undefined) {
      await query(`UPDATE workspaces SET description = $1 WHERE workspace_id = $2`, [newDescription, workspaceId]);
    }

    return NextResponse.json({ success: true, name: rawName, description: newDescription });
  } catch (error) {
    console.error("PATCH WORKSPACE ERROR:", error);
    return NextResponse.json({ error: "Failed to rename workspace" }, { status: 500 });
  }
}

// DELETE — workspace owner deletes the entire workspace
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: workspaceIdParam } = await context.params;
    const workspaceId = parseWorkspaceId(workspaceIdParam);
    if (workspaceId === null) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    const memberRow = await query(
      `SELECT is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, userId],
    );
    if (memberRow.rows.length === 0 || !memberRow.rows[0].is_owner) {
      return NextResponse.json({ error: "Only workspace owners can delete a workspace" }, { status: 403 });
    }

    await query(`DELETE FROM workspaces WHERE workspace_id = $1`, [workspaceId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE WORKSPACE ERROR:", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}

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
