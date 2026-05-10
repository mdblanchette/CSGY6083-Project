import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// PATCH — promote/demote a workspace member
//   body { action: "promote" | "demote" }
//   promote: regular → admin (actor must be admin or owner)
//            admin   → owner (actor must be owner)
//   demote:  admin   → regular (actor must be owner; cannot demote owners)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  try {
    const { workspaceId: wParam, memberId: mParam } = await context.params;
    const workspaceId = parseId(wParam);
    const memberId = parseId(mParam);

    if (workspaceId === null || memberId === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action === "demote" ? "demote" : "promote";

    const actorId = Number(session.user.id);

    if (memberId === actorId) {
      return NextResponse.json({ error: "Cannot change your own role this way" }, { status: 400 });
    }

    const actorRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, actorId],
    );
    if (actorRow.rows.length === 0) {
      return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
    }
    const actorIsAdmin: boolean = actorRow.rows[0].is_admin;
    const actorIsOwner: boolean = actorRow.rows[0].is_owner;

    if (!actorIsAdmin && !actorIsOwner) {
      return NextResponse.json({ error: "Only admins can manage members" }, { status: 403 });
    }

    const targetRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, memberId],
    );
    if (targetRow.rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const targetIsAdmin: boolean = targetRow.rows[0].is_admin;
    const targetIsOwner: boolean = targetRow.rows[0].is_owner;

    if (action === "promote") {
      if (targetIsAdmin || targetIsOwner) {
        return NextResponse.json({ error: "Member is already an admin or owner" }, { status: 409 });
      }
      // regular → admin
      await query(
        `UPDATE workspace_members SET is_admin = true
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, memberId],
      );
      return NextResponse.json({ success: true, result: "promoted_to_admin" });
    } else {
      // demote: admin → regular (owner only, cannot demote other owners)
      if (!actorIsOwner) {
        return NextResponse.json({ error: "Only owners can demote members" }, { status: 403 });
      }
      if (targetIsOwner) {
        return NextResponse.json({ error: "Cannot demote another owner" }, { status: 409 });
      }
      if (!targetIsAdmin) {
        return NextResponse.json({ error: "Member is not an admin" }, { status: 409 });
      }
      await query(
        `UPDATE workspace_members SET is_admin = false, is_owner = false
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, memberId],
      );
      return NextResponse.json({ success: true, result: "demoted_to_member" });
    }
  } catch (error) {
    console.error("MEMBER ROLE ACTION ERROR:", error);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}

// DELETE — remove a member from the workspace
//   admin can remove regular members
//   owner can remove admins and regular members (not other owners)
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  try {
    const { workspaceId: wParam, memberId: mParam } = await context.params;
    const workspaceId = parseId(wParam);
    const memberId = parseId(mParam);

    if (workspaceId === null || memberId === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorId = Number(session.user.id);

    if (memberId === actorId) {
      return NextResponse.json({ error: "Use Leave Workspace to remove yourself" }, { status: 400 });
    }

    const actorRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, actorId],
    );
    if (actorRow.rows.length === 0 || !actorRow.rows[0].is_admin) {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }
    const actorIsOwner: boolean = actorRow.rows[0].is_owner;

    const targetRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, memberId],
    );
    if (targetRow.rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const targetIsOwner: boolean = targetRow.rows[0].is_owner;
    const targetIsAdmin: boolean = targetRow.rows[0].is_admin;

    if (targetIsOwner) {
      return NextResponse.json({ error: "Cannot remove an owner" }, { status: 409 });
    }
    if (targetIsAdmin && !actorIsOwner) {
      return NextResponse.json({ error: "Only owners can remove admins" }, { status: 403 });
    }

    await query("BEGIN");
    try {
      await query(
        `DELETE FROM channel_members
         WHERE user_id = $1
           AND channel_id IN (SELECT channel_id FROM channels WHERE workspace_id = $2)`,
        [memberId, workspaceId],
      );
      await query(
        `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, memberId],
      );
      await query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("REMOVE MEMBER ERROR:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
