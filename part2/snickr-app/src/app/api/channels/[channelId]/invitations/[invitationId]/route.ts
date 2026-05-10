import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// PATCH — accept or decline a channel invitation
export async function PATCH(
  request: Request,
  context: { params: Promise<{ channelId: string; invitationId: string }> },
) {
  try {
    const { channelId: channelIdParam, invitationId: invitationIdParam } =
      await context.params;

    const channelId = parseId(channelIdParam);
    const invitationId = parseId(invitationIdParam);

    if (channelId === null || invitationId === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const body = await request.json();
    const action = body?.action;

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be accept or decline" },
        { status: 400 },
      );
    }

    const inviteResult = await query(
      `SELECT invitation_id, channel_id, invitee, status
       FROM channel_invitations
       WHERE invitation_id = $1 AND channel_id = $2 AND invitee = $3 LIMIT 1`,
      [invitationId, channelId, userId],
    );

    if (inviteResult.rows.length === 0) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (inviteResult.rows[0].status !== "pending") {
      return NextResponse.json(
        { error: "Invitation is no longer pending" },
        { status: 409 },
      );
    }

    if (action === "decline") {
      const result = await query(
        `UPDATE channel_invitations SET status = 'declined'
         WHERE invitation_id = $1
         RETURNING invitation_id AS id, status`,
        [invitationId],
      );
      return NextResponse.json(result.rows[0]);
    }

    // Accept: add to channel_members in a transaction
    await query("BEGIN");
    try {
      await query(
        `INSERT INTO channel_members (channel_id, user_id, is_admin)
         VALUES ($1, $2, false)
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channelId, userId],
      );

      const result = await query(
        `UPDATE channel_invitations SET status = 'accepted'
         WHERE invitation_id = $1
         RETURNING invitation_id AS id, status`,
        [invitationId],
      );

      await query("COMMIT");
      return NextResponse.json(result.rows[0]);
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("RESPOND CHANNEL INVITATION ERROR:", error);
    return NextResponse.json(
      { error: "Failed to respond to invitation" },
      { status: 500 },
    );
  }
}
