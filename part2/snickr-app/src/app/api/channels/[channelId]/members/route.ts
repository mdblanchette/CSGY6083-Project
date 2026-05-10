import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseChannelId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

// DELETE — leave a channel
export async function DELETE(
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

    // Verify membership
    const memberRow = await query(
      `SELECT is_admin FROM channel_members
       WHERE channel_id = $1 AND user_id = $2 LIMIT 1`,
      [channelId, userId],
    );
    if (memberRow.rows.length === 0) {
      return NextResponse.json({ error: "You are not a member of this channel" }, { status: 403 });
    }

    // Block last admin from leaving if other members exist
    if (memberRow.rows[0].is_admin) {
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
          { error: "You are the only admin. Assign another admin before leaving." },
          { status: 409 },
        );
      }
    }

    await query(
      `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LEAVE CHANNEL ERROR:", error);
    return NextResponse.json({ error: "Failed to leave channel" }, { status: 500 });
  }
}
