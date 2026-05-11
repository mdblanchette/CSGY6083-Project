import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseWorkspaceId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// DELETE — leave a workspace (and all its channels)
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
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, userId],
    );
    if (memberRow.rows.length === 0) {
      return NextResponse.json({ error: "You are not a member of this workspace" }, { status: 403 });
    }

    const memberCount = await query(
      `SELECT COUNT(*)::int AS count FROM workspace_members WHERE workspace_id = $1`,
      [workspaceId],
    );
    const totalMembers = (memberCount.rows[0] as { count: number }).count;

    // Owners must assign another owner before leaving if other members remain
    if (memberRow.rows[0].is_owner && totalMembers > 1) {
      const ownerCount = await query(
        `SELECT COUNT(*)::int AS count FROM workspace_members
         WHERE workspace_id = $1 AND is_owner = true`,
        [workspaceId],
      );
      if ((ownerCount.rows[0] as { count: number }).count === 1) {
        return NextResponse.json(
          { error: "You are the only owner. Assign another owner before leaving." },
          { status: 409 },
        );
      }
    } else if (memberRow.rows[0].is_admin && !memberRow.rows[0].is_owner && totalMembers > 1) {
      // Non-owner admins: block only if they're the last admin and there are no owners
      const adminCount = await query(
        `SELECT COUNT(*)::int AS count FROM workspace_members
         WHERE workspace_id = $1 AND is_admin = true`,
        [workspaceId],
      );
      if ((adminCount.rows[0] as { count: number }).count === 1) {
        return NextResponse.json(
          { error: "You are the only admin. Assign another admin before leaving." },
          { status: 409 },
        );
      }
    }

    await query("BEGIN");
    try {
      await query(
        `DELETE FROM channel_members
         WHERE user_id = $1
           AND channel_id IN (
             SELECT channel_id FROM channels WHERE workspace_id = $2
           )`,
        [userId, workspaceId],
      );
      await query(
        `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId],
      );
      await query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("LEAVE WORKSPACE ERROR:", error);
    return NextResponse.json({ error: "Failed to leave workspace" }, { status: 500 });
  }
}
