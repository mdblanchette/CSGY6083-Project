import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    const result = await query(
      `
        SELECT
          wi.invitation_id AS id,
          wi.workspace_id AS "workspaceId",
          w.name AS "workspaceName",
          inviter.username AS "inviterUsername",
          wi.invited_at AS "invitedAt"
        FROM workspace_invitations wi
        JOIN workspaces w
          ON w.workspace_id = wi.workspace_id
        JOIN users inviter
          ON inviter.user_id = wi.inviter
        WHERE wi.invitee = $1
          AND wi.status = 'pending'
        ORDER BY wi.invited_at DESC
      `,
      [userId],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("FETCH WORKSPACE INVITATIONS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch workspace invitations" },
      { status: 500 },
    );
  }
}
