import { NextResponse } from "next/server";
import { getAuthSession } from "@/libs/auth";
import { query } from "@/libs/db";
import {
  addChannelMembership,
  resolveChannelAccess,
} from "@/libs/channel-access";

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

type MessageRow = {
  id: number;
  body: string;
  postedAt: string;
  senderName: string | null;
  senderEmail: string | null;
};

const parseChannelId = (value: string) => {
  const channelId = Number.parseInt(value, 10);
  return Number.isFinite(channelId) ? channelId : null;
};

const resolveAccessForUser = async (channelId: number, userId: number) => {
  let schema: "lower" | "upper" = "lower";
  let access: Awaited<ReturnType<typeof resolveChannelAccess>> = null;

  try {
    access = await resolveChannelAccess(channelId, userId, schema);
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }
  }

  if (!access) {
    schema = "upper";

    try {
      access = await resolveChannelAccess(channelId, userId, schema);
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }
  }

  return { access, schema };
};

const getTables = (schema: "lower" | "upper") => {
  return schema === "lower"
    ? {
        channels: "channels",
        workspaceMembers: "workspace_members",
        channelMembers: "channel_members",
        users: "users",
        messages: "messages",
      }
    : {
        channels: '"Channels"',
        workspaceMembers: '"Workspace_Members"',
        channelMembers: '"Channel_Members"',
        users: '"Users"',
        messages: '"Messages"',
      };
};

const buildChannelDetail = async (
  channelId: number,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

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

const createMessageForSchema = async (
  channelId: number,
  userId: number,
  messageBody: string,
  schema: "lower" | "upper",
) => {
  const { access, schema: resolvedSchema } = await resolveAccessForUser(
    channelId,
    userId,
  );

  const tables = getTables(resolvedSchema);

  if (!access) {
    return { status: "not_found" as const };
  }

  if (!access.canView) {
    if (!access.isWorkspaceMember) {
      return { status: "forbidden_workspace" as const };
    }

    return { status: "forbidden_channel" as const };
  }

  if (access.shouldAutoJoin) {
    try {
      await addChannelMembership(channelId, userId, resolvedSchema);
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }

      await addChannelMembership(channelId, userId, "upper");
    }
  }

  const messageInsertResult = await query(
    `
      INSERT INTO ${tables.messages} (channel_id, sender_id, body)
      VALUES ($1, $2, $3)
      RETURNING message_id AS id, body, posted_at AS "postedAt"
    `,
    [channelId, userId, messageBody],
  );

  const messageRow = messageInsertResult.rows[0] as {
    id: number;
    body: string;
    postedAt: string;
  };

  const senderResult = await query(
    `
      SELECT username AS "senderName", email AS "senderEmail"
      FROM ${tables.users}
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  const sender = senderResult.rows[0] as
    | { senderName: string | null; senderEmail: string | null }
    | undefined;

  const memberCountResult = await query(
    `
      SELECT COUNT(*)::int AS count
      FROM ${tables.channelMembers}
      WHERE channel_id = $1
    `,
    [channelId],
  );

  const memberCount = (memberCountResult.rows[0] as { count: number }).count;

  return {
    status: "created" as const,
    channelId,
    memberCount,
    message: {
      id: messageRow.id,
      body: messageRow.body,
      postedAt: messageRow.postedAt,
      senderName: sender?.senderName ?? null,
      senderEmail: sender?.senderEmail ?? null,
    } as MessageRow,
  };
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

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number.parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { access, schema } = await resolveAccessForUser(channelId, userId);

    if (!access) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!access.canView) {
      return NextResponse.json(
        { error: "You do not have access to this channel" },
        { status: 403 },
      );
    }

    if (access.shouldAutoJoin) {
      try {
        await addChannelMembership(channelId, userId, schema);
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }

        await addChannelMembership(channelId, userId, "upper");
      }
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

export async function POST(
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

    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number.parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const messageBody = typeof body?.body === "string" ? body.body.trim() : "";

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message body is required" },
        { status: 400 },
      );
    }

    let result: Awaited<ReturnType<typeof createMessageForSchema>> | null =
      null;

    try {
      result = await createMessageForSchema(
        channelId,
        userId,
        messageBody,
        "lower",
      );
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!result) {
      try {
        result = await createMessageForSchema(
          channelId,
          userId,
          messageBody,
          "upper",
        );
      } catch (error: any) {
        if (error?.code !== "42P01") {
          throw error;
        }
      }
    }

    if (!result || result.status === "not_found") {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (result.status === "forbidden_workspace") {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 403 },
      );
    }

    if (result.status === "forbidden_channel") {
      return NextResponse.json(
        { error: "You are not a member of this channel" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        message: result.message,
        channel: {
          id: result.channelId,
          memberCount: result.memberCount,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 },
    );
  }
}
