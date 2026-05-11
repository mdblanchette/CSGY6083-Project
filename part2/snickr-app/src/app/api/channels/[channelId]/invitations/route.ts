import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseChannelId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// GET — pending channel invitations for the logged-in user in this channel
export async function GET(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId: channelIdParam } = await context.params;
    const channelId = parseChannelId(channelIdParam);
    if (channelId === null) {
      return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
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
          inviter.username AS "inviterUsername",
          ci.status,
          ci.invited_at    AS "invitedAt"
        FROM channel_invitations ci
        JOIN channels c   ON c.channel_id = ci.channel_id
        JOIN users inviter ON inviter.user_id = ci.inviter
        WHERE ci.channel_id = $1
          AND ci.invitee = $2
          AND ci.status = 'pending'
        ORDER BY ci.invited_at DESC
      `,
      [channelId, userId],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("FETCH CHANNEL INVITATIONS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch channel invitations" }, { status: 500 });
  }
}

// POST — send a channel invitation (channel admin only)
export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId: channelIdParam } = await context.params;
    const channelId = parseChannelId(channelIdParam);
    if (channelId === null) {
      return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inviterId = Number(session.user.id);
    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";

    if (!identifier) {
      return NextResponse.json({ error: "Username or email is required" }, { status: 400 });
    }

    // Get workspace_id and channel_type for the channel
    const channelRow = await query(
      `SELECT workspace_id, channel_type FROM channels WHERE channel_id = $1 LIMIT 1`,
      [channelId],
    );
    if (channelRow.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const { workspace_id: workspaceId, channel_type: channelType } = channelRow.rows[0];
    const isDirect = (channelType as string).toLowerCase() === "direct";

    // Only channel admins can invite
    const adminCheck = await query(
      `SELECT 1 FROM channel_members
       WHERE channel_id = $1 AND user_id = $2 AND is_admin = true
       LIMIT 1`,
      [channelId, inviterId],
    );
    if (adminCheck.rows.length === 0) {
      return NextResponse.json({ error: "Only channel admins can invite users" }, { status: 403 });
    }

    // Find invitee by username or email
    const inviteeResult = await query(
      `SELECT user_id FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
      [identifier],
    );
    if (inviteeResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const inviteeId = inviteeResult.rows[0].user_id;

    if (inviteeId === inviterId) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    // Invitee must be a workspace member
    const workspaceMember = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, inviteeId],
    );
    if (workspaceMember.rows.length === 0) {
      return NextResponse.json(
        { error: "User must be a workspace member to be invited to a channel" },
        { status: 409 },
      );
    }

    // Cannot invite existing channel members
    const existingMember = await query(
      `SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2 LIMIT 1`,
      [channelId, inviteeId],
    );
    if (existingMember.rows.length > 0) {
      return NextResponse.json({ error: "User is already a channel member" }, { status: 409 });
    }

    // Direct channels: max 2 members total; max 1 pending invite at a time
    if (isDirect) {
      const memberCountResult = await query(
        `SELECT COUNT(*)::int AS count FROM channel_members WHERE channel_id = $1`,
        [channelId],
      );
      if ((memberCountResult.rows[0] as { count: number }).count >= 2) {
        return NextResponse.json(
          { error: "Direct channel is full (maximum 2 members)" },
          { status: 409 },
        );
      }
      const pendingCountResult = await query(
        `SELECT COUNT(*)::int AS count FROM channel_invitations
         WHERE channel_id = $1 AND status = 'pending'`,
        [channelId],
      );
      if ((pendingCountResult.rows[0] as { count: number }).count > 0) {
        return NextResponse.json(
          { error: "Direct channel already has a pending invitation" },
          { status: 409 },
        );
      }
    }

    // No duplicate pending invitations
    const existingInvite = await query(
      `SELECT 1 FROM channel_invitations
       WHERE channel_id = $1 AND invitee = $2 AND status = 'pending' LIMIT 1`,
      [channelId, inviteeId],
    );
    if (existingInvite.rows.length > 0) {
      return NextResponse.json({ error: "User already has a pending invitation" }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO channel_invitations (channel_id, inviter, invitee)
       VALUES ($1, $2, $3)
       RETURNING
         invitation_id AS id,
         channel_id    AS "channelId",
         inviter       AS "inviterId",
         invitee       AS "inviteeId",
         status,
         invited_at    AS "invitedAt"`,
      [channelId, inviterId, inviteeId],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("CREATE CHANNEL INVITATION ERROR:", error);
    return NextResponse.json({ error: "Failed to create channel invitation" }, { status: 500 });
  }
}
