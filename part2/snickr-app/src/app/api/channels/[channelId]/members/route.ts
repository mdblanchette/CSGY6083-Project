import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseChannelId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// POST — self-join a public channel
export async function POST(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId: channelIdParam } = await context.params;
    const channelId = parseChannelId(channelIdParam);
    if (channelId === null) {
      return NextResponse.json(
        { error: "Invalid channel id" },
        { status: 400 },
      );
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    const channelRow = await query(
      `SELECT channel_type, workspace_id FROM channels WHERE channel_id = $1 LIMIT 1`,
      [channelId],
    );
    if (channelRow.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const { channel_type, workspace_id } = channelRow.rows[0] as {
      channel_type: string;
      workspace_id: number;
    };
    if (channel_type.toLowerCase() !== "public") {
      return NextResponse.json(
        { error: "Can only self-join public channels" },
        { status: 403 },
      );
    }

    const wsMember = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspace_id, userId],
    );
    if (wsMember.rows.length === 0) {
      return NextResponse.json(
        { error: "Not a workspace member" },
        { status: 403 },
      );
    }

    await query(
      `INSERT INTO channel_members (channel_id, user_id, is_admin, joined_at)
       VALUES ($1, $2, false, NOW())
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, userId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("JOIN CHANNEL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to join channel" },
      { status: 500 },
    );
  }
}

// DELETE — leave a channel
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId: channelIdParam } = await context.params;
    const channelId = parseChannelId(channelIdParam);
    if (channelId === null) {
      return NextResponse.json(
        { error: "Invalid channel id" },
        { status: 400 },
      );
    }

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    // Verify membership and get channel type in one shot
    const memberRow = await query(
      `SELECT cm.is_admin, c.channel_type
       FROM channel_members cm
       JOIN channels c ON c.channel_id = cm.channel_id
       WHERE cm.channel_id = $1 AND cm.user_id = $2 LIMIT 1`,
      [channelId, userId],
    );
    if (memberRow.rows.length === 0) {
      return NextResponse.json(
        { error: "You are not a member of this channel" },
        { status: 403 },
      );
    }

    const channelType = (
      memberRow.rows[0].channel_type as string
    ).toLowerCase();
    const isDirect = channelType === "direct";
    const isPublic = channelType === "public";

    // Block last admin from leaving only for non-public channels.
    if (memberRow.rows[0].is_admin && !isDirect && !isPublic) {
      const adminCount = await query(
        `SELECT COUNT(*)::int AS count FROM channel_members
         WHERE channel_id = $1 AND is_admin = true`,
        [channelId],
      );
      const memberCount = await query(
        `SELECT COUNT(*)::int AS count FROM channel_members WHERE channel_id = $1`,
        [channelId],
      );
      if (
        (adminCount.rows[0] as { count: number }).count === 1 &&
        (memberCount.rows[0] as { count: number }).count > 1
      ) {
        return NextResponse.json(
          {
            error:
              "You are the only admin. Assign another admin before leaving.",
          },
          { status: 409 },
        );
      }
    }

    await query(
      `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId],
    );

    // Auto-delete private/direct channels when the last member leaves
    if (channelType !== "public") {
      const remaining = await query(
        `SELECT COUNT(*)::int AS count FROM channel_members WHERE channel_id = $1`,
        [channelId],
      );
      if ((remaining.rows[0] as { count: number }).count === 0) {
        await query(`DELETE FROM channels WHERE channel_id = $1`, [channelId]);
        return NextResponse.json({ success: true, channelDeleted: true });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LEAVE CHANNEL ERROR:", error);
    return NextResponse.json(
      { error: "Failed to leave channel" },
      { status: 500 },
    );
  }
}
