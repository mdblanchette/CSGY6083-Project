import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

type CurrentUserMembership = {
  isMember: boolean;
  isAdmin: boolean;
} | null;

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
    senderNickname: string | null;
    senderEmail: string | null;
    senderImage: string | null;
  }>;
};

type MessageRow = {
  id: number;
  body: string;
  postedAt: string;
  senderName: string | null;
  senderNickname: string | null;
  senderEmail: string | null;
  senderImage: string | null;
};

const parseChannelId = (value: string) => {
  const channelId = Number.parseInt(value, 10);
  return Number.isFinite(channelId) ? channelId : null;
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
  userId?: number,
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
        CASE
          WHEN LOWER(c.channel_type) = 'public' THEN (
            SELECT COUNT(*)::int
            FROM ${tables.workspaceMembers} wm
            WHERE wm.workspace_id = c.workspace_id
          )
          ELSE (
            (SELECT COUNT(*)::int FROM ${tables.channelMembers} cm WHERE cm.channel_id = c.channel_id)
            + (SELECT COUNT(*)::int FROM ${tables.workspaceMembers} wm_o
               WHERE wm_o.workspace_id = c.workspace_id
                 AND wm_o.is_owner = true
                 AND NOT EXISTS (
                   SELECT 1 FROM ${tables.channelMembers} cm2
                   WHERE cm2.channel_id = c.channel_id AND cm2.user_id = wm_o.user_id
                 ))
          )
        END AS "memberCount",
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
        u.nickname AS "senderNickname",
        u.email AS "senderEmail",
        u.image AS "senderImage"
      FROM ${tables.messages} m
      LEFT JOIN ${tables.users} u
        ON u.user_id = m.sender_id
      WHERE m.channel_id = $1
      ORDER BY m.posted_at DESC
      LIMIT 100
    `,
    [channelId],
  );

  let currentUser: CurrentUserMembership = null;
  if (userId !== undefined) {
    const memberRow = await query(
      `SELECT
         cm.is_admin      AS cm_is_admin,
         wm.is_owner      AS wm_is_owner
       FROM ${tables.channels} c
       LEFT JOIN ${tables.channelMembers} cm
         ON cm.channel_id = c.channel_id AND cm.user_id = $2
       LEFT JOIN ${tables.workspaceMembers} wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
       WHERE c.channel_id = $1
       LIMIT 1`,
      [channelId, userId],
    );
    if (memberRow.rows.length > 0) {
      const row = memberRow.rows[0];
      const isChannelMember = row.cm_is_admin !== null;
      const isWorkspaceOwner = Boolean(row.wm_is_owner);
      currentUser = (isChannelMember || isWorkspaceOwner)
        ? { isMember: true, isAdmin: isChannelMember ? Boolean(row.cm_is_admin) : true }
        : { isMember: false, isAdmin: false };
    }
  }

  return {
    channel: channelResult.rows[0],
    messages: messagesResult.rows.reverse(),
    currentUser,
  } as ChannelDetail & { currentUser: CurrentUserMembership };
};

const createMessageForSchema = async (
  channelId: number,
  userId: number,
  messageBody: string,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

  const accessResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.workspace_id AS "workspaceId",
        c.channel_type AS type,
        CASE
          WHEN LOWER(c.channel_type) = 'public' THEN (
            SELECT COUNT(*)::int FROM ${tables.workspaceMembers} wm
            WHERE wm.workspace_id = c.workspace_id
          )
          ELSE (
            (SELECT COUNT(*)::int FROM ${tables.channelMembers} cm WHERE cm.channel_id = c.channel_id)
            + (SELECT COUNT(*)::int FROM ${tables.workspaceMembers} wm_o
               WHERE wm_o.workspace_id = c.workspace_id
                 AND wm_o.is_owner = true
                 AND NOT EXISTS (
                   SELECT 1 FROM ${tables.channelMembers} cm2
                   WHERE cm2.channel_id = c.channel_id AND cm2.user_id = wm_o.user_id
                 ))
          )
        END AS "memberCount",
        EXISTS (
          SELECT 1
          FROM ${tables.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id
            AND wm.user_id = $2
        ) AS "isWorkspaceMember",
        EXISTS (
          SELECT 1
          FROM ${tables.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id
            AND wm.user_id = $2
            AND wm.is_owner = true
        ) AS "isWorkspaceOwner",
        EXISTS (
          SELECT 1
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
            AND cm.user_id = $2
        ) AS "isChannelMember"
      FROM ${tables.channels} c
      WHERE c.channel_id = $1
      LIMIT 1
    `,
    [channelId, userId],
  );

  if (accessResult.rows.length === 0) {
    return { status: "not_found" as const };
  }

  const accessRow = accessResult.rows[0] as {
    type: string;
    workspaceId: number;
    memberCount: number;
    isWorkspaceMember: boolean;
    isWorkspaceOwner: boolean;
    isChannelMember: boolean;
  };

  if (!accessRow.isWorkspaceMember) {
    return { status: "forbidden_workspace" as const };
  }

  const isPublicChannel = accessRow.type === "public";
  const canPost = accessRow.isChannelMember || isPublicChannel || accessRow.isWorkspaceOwner;

  if (!canPost) {
    return { status: "forbidden_channel" as const };
  }

  let memberCount = accessRow.memberCount;

  if (!accessRow.isChannelMember && isPublicChannel) {
    await query(
      `
        INSERT INTO ${tables.channelMembers} (channel_id, user_id, is_admin)
        VALUES ($1, $2, false)
        ON CONFLICT (channel_id, user_id) DO NOTHING
      `,
      [channelId, userId],
    );
  }

  if (isPublicChannel) {
    const memberCountResult = await query(
      `
        SELECT COUNT(*)::int AS count
        FROM ${tables.workspaceMembers}
        WHERE workspace_id = $1
      `,
      [accessRow.workspaceId],
    );

    memberCount = (memberCountResult.rows[0] as { count: number }).count;
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
      SELECT
        username AS "senderName",
        nickname AS "senderNickname",
        email AS "senderEmail",
        image AS "senderImage"
      FROM ${tables.users}
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  const sender = senderResult.rows[0] as
    | {
        senderName: string | null;
        senderNickname: string | null;
        senderEmail: string | null;
        senderImage: string | null;
      }
    | undefined;

  return {
    status: "created" as const,
    channelId,
    memberCount,
    message: {
      id: messageRow.id,
      body: messageRow.body,
      postedAt: messageRow.postedAt,
      senderName: sender?.senderName ?? null,
      senderNickname: sender?.senderNickname ?? null,
      senderEmail: sender?.senderEmail ?? null,
      senderImage: sender?.senderImage ?? null,
    } as MessageRow,
  };
};

// PATCH — workspace admin or owner updates channel name and/or type
export async function PATCH(
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

    const userId = Number(session.user.id);
    const body = await request.json().catch(() => ({}));
    const newName: string | undefined = typeof body?.name === "string" ? body.name.trim() : undefined;
    const newType: string | undefined = body?.type;

    if (!newName && !newType) {
      return NextResponse.json({ error: "Provide name or type to update" }, { status: 400 });
    }
    if (newName !== undefined && newName.length === 0) {
      return NextResponse.json({ error: "Channel name cannot be empty" }, { status: 400 });
    }
    if (newType !== undefined && newType !== "public" && newType !== "private") {
      return NextResponse.json({ error: "type must be 'public' or 'private'" }, { status: 400 });
    }

    const channelRow = await query(
      `SELECT workspace_id, channel_type FROM channels WHERE channel_id = $1 LIMIT 1`,
      [channelId],
    );
    if (channelRow.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const workspaceId: number = channelRow.rows[0].workspace_id;
    const currentType: string = channelRow.rows[0].channel_type;

    const memberRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, userId],
    );
    if (memberRow.rows.length === 0 || (!memberRow.rows[0].is_admin && !memberRow.rows[0].is_owner)) {
      return NextResponse.json({ error: "Only workspace admins can update channels" }, { status: 403 });
    }

    // Rename
    if (newName) {
      await query(`UPDATE channels SET name = $1 WHERE channel_id = $2`, [newName, channelId]);
    }

    // Change type
    if (newType && newType !== currentType.toLowerCase()) {
      if (newType === "private") {
        await query("BEGIN");
        try {
          await query(
            `INSERT INTO channel_members (channel_id, user_id, is_admin)
             SELECT $1, wm.user_id, false
             FROM workspace_members wm
             WHERE wm.workspace_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM channel_members cm
                 WHERE cm.channel_id = $1 AND cm.user_id = wm.user_id
               )`,
            [channelId, workspaceId],
          );
          await query(`UPDATE channels SET channel_type = 'private' WHERE channel_id = $1`, [channelId]);
          await query("COMMIT");
        } catch (err) {
          await query("ROLLBACK");
          throw err;
        }
      } else {
        await query(`UPDATE channels SET channel_type = 'public' WHERE channel_id = $1`, [channelId]);
      }
    }

    return NextResponse.json({ success: true, name: newName, type: newType ?? currentType });
  } catch (error) {
    console.error("PATCH CHANNEL ERROR:", error);
    return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });
  }
}

// DELETE — workspace admin or owner deletes the channel entirely
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

    // Resolve the channel's workspace
    const channelRow = await query(
      `SELECT workspace_id FROM channels WHERE channel_id = $1 LIMIT 1`,
      [channelId],
    );
    if (channelRow.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const workspaceId: number = channelRow.rows[0].workspace_id;

    // Only workspace admins or owners may delete channels
    const memberRow = await query(
      `SELECT is_admin, is_owner FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, userId],
    );
    if (memberRow.rows.length === 0 || !memberRow.rows[0].is_admin) {
      return NextResponse.json({ error: "Only workspace admins can delete channels" }, { status: 403 });
    }

    await query(`DELETE FROM channels WHERE channel_id = $1`, [channelId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE CHANNEL ERROR:", error);
    return NextResponse.json({ error: "Failed to delete channel" }, { status: 500 });
  }
}

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
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    let detail = null;

    try {
      detail = await buildChannelDetail(channelId, "lower", userId);
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }

    if (!detail) {
      try {
        detail = await buildChannelDetail(channelId, "upper", userId);
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
