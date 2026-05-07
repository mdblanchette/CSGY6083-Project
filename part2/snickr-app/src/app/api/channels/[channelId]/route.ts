import { NextResponse } from "next/server";
import { query } from "@/libs/db";

export const runtime = "nodejs";

type ChannelDetail = {
  channel: {
    id: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    messageCount: number;
  };
  messages: Array<{
    id: number;
    body: string;
    postedAt: string;
    senderName: string | null;
    senderEmail: string | null;
  }>;
};

const parseChannelId = (value: string) => {
  const channelId = Number.parseInt(value, 10);
  return Number.isFinite(channelId) ? channelId : null;
};

const buildChannelDetail = async (
  channelId: number,
  schema: "lower" | "upper",
) => {
  const tables =
    schema === "lower"
      ? {
          channels: "channels",
          channelMembers: "channel_members",
          users: "users",
          messages: "messages",
        }
      : {
          channels: '"Channels"',
          channelMembers: '"Channel_Members"',
          users: '"Users"',
          messages: '"Messages"',
        };

  const channelResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.name,
        c.channel_type AS type,
        c.description,
        c.created_at AS "createdAt",
        (
          SELECT COUNT(*)::int
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
        ) AS "memberCount",
        (
          SELECT COUNT(*)::int
          FROM ${tables.messages} m
          WHERE m.channel_id = c.channel_id
        ) AS "messageCount"
      FROM ${tables.channels} c
      WHERE c.channel_id = $1
      LIMIT 1
    `,
    [channelId],
  );

  if (channelResult.rows.length === 0) {
    return null;
  }

  const messagesResult = await query(
    `
      SELECT
        m.message_id AS id,
        m.body,
        m.posted_at AS "postedAt",
        u.username AS "senderName",
        u.email AS "senderEmail"
      FROM ${tables.messages} m
      LEFT JOIN ${tables.users} u
        ON u.user_id = m.sender_id
      WHERE m.channel_id = $1
      ORDER BY m.posted_at DESC
      LIMIT 100
    `,
    [channelId],
  );

  return {
    channel: channelResult.rows[0],
    messages: messagesResult.rows.reverse(),
  } as ChannelDetail;
};

export async function GET(
  request: Request,
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

    let detail = null;

    try {
      detail = await buildChannelDetail(channelId, "lower");
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!detail) {
      try {
        detail = await buildChannelDetail(channelId, "upper");
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }
      }
    }

    if (!detail) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch channel details" },
      { status: 500 },
    );
  }
}
