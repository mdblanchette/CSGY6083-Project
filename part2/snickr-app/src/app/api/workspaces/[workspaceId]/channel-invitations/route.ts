import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseWorkspaceId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// GET — all pending channel invitations for the logged-in user in this workspace
export async function GET(
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

    const result = await query(
      `
        SELECT
          ci.invitation_id AS id,
          ci.channel_id    AS "channelId",
          c.name           AS "channelName",
          ci.inviter       AS "inviterId",
          u.username       AS "inviterUsername",
          ci.invited_at    AS "invitedAt"
        FROM channel_invitations ci
        JOIN channels c ON c.channel_id = ci.channel_id
        JOIN users u    ON u.user_id = ci.inviter
        WHERE c.workspace_id = $1
          AND ci.invitee = $2
          AND ci.status = 'pending'
        ORDER BY ci.invited_at DESC
      `,
      [workspaceId, userId],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("FETCH WORKSPACE CHANNEL INVITATIONS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel invitations" },
      { status: 500 },
    );
  }
}
