export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/libs/auth";
import { query } from "@/libs/db";

type ChannelResponse = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
};

type ChannelTables = {
  channels: string;
  channelMembers: string;
  workspaceMembers: string;
};

const getTables = (schema: "lower" | "upper"): ChannelTables => {
  return schema === "lower"
    ? {
        channels: "channels",
        channelMembers: "channel_members",
        workspaceMembers: "workspace_members",
      }
    : {
        channels: '"Channels"',
        channelMembers: '"Channel_Members"',
        workspaceMembers: '"Workspace_Members"',
      };
};

const parseWorkspaceId = (value: string) => {
  const workspaceId = Number.parseInt(value, 10);
  return Number.isFinite(workspaceId) ? workspaceId : null;
};

const ensureWorkspaceMember = async (
  workspaceId: number,
  userId: number,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

  const result = await query(
    `
      SELECT 1
      FROM ${tables.workspaceMembers}
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId],
  );

  return result.rows.length > 0;
};

const findExistingDirectChannel = async (
  workspaceId: number,
  creatorId: number,
  directUserId: number,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

  const result = await query(
    `
      SELECT
        c.channel_id AS id,
        c.name,
        c.channel_type AS type,
        c.description,
        c.created_at AS "createdAt"
      FROM ${tables.channels} c
      WHERE c.workspace_id = $1
        AND c.channel_type = 'direct'
        AND EXISTS (
          SELECT 1
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
            AND cm.user_id = $2
        )
        AND EXISTS (
          SELECT 1
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
            AND cm.user_id = $3
        )
        AND (
          SELECT COUNT(*)::int
          FROM ${tables.channelMembers} cm
          WHERE cm.channel_id = c.channel_id
        ) = 2
      LIMIT 1
    `,
    [workspaceId, creatorId, directUserId],
  );

  return (result.rows[0] as ChannelResponse | undefined) ?? null;
};

const createChannel = async (
  workspaceId: number,
  name: string,
  channelType: string,
  description: string | null,
  createdBy: number,
  directUserId: number | null,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

  if (channelType === "direct" && directUserId !== null) {
    const existingDirectChannel = await findExistingDirectChannel(
      workspaceId,
      createdBy,
      directUserId,
      schema,
    );

    if (existingDirectChannel) {
      return existingDirectChannel;
    }
  }

  const result = await query(
    `
      INSERT INTO ${tables.channels} (workspace_id, name, channel_type, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING channel_id AS id, name, channel_type AS type, description, created_at AS "createdAt"
    `,
    [workspaceId, name, channelType, description, createdBy],
  );

  const row = result.rows[0] as ChannelResponse;

  if (channelType === "direct" && directUserId !== null) {
    try {
      await query(
        `
          INSERT INTO ${tables.channelMembers} (channel_id, user_id, is_admin)
          VALUES ($1, $2, false), ($1, $3, false)
          ON CONFLICT (channel_id, user_id) DO NOTHING
        `,
        [row.id, createdBy, directUserId],
      );
    } catch {
      // best effort
    }
  } else {
    try {
      await query(
        `
          INSERT INTO ${tables.channelMembers} (channel_id, user_id, is_admin)
          VALUES ($1, $2, true)
          ON CONFLICT (channel_id, user_id) DO NOTHING
        `,
        [row.id, createdBy],
      );
    } catch {
      // best effort
    }
  }

  return row;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId: workspaceIdParam } = await context.params;
    const workspaceId = parseWorkspaceId(workspaceIdParam);

    if (workspaceId === null) {
      return NextResponse.json(
        { error: "Invalid workspace id" },
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

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const channelType =
      typeof body?.channelType === "string"
        ? body.channelType.toLowerCase()
        : "public";
    const description =
      typeof body?.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null;
    const directUserId =
      typeof body?.directUserId === "number"
        ? body.directUserId
        : typeof body?.directUserId === "string"
          ? Number.parseInt(body.directUserId, 10)
          : null;

    if (!name) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 },
      );
    }

    if (!["public", "private", "direct"].includes(channelType)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 },
      );
    }

    if (channelType === "direct") {
      if (!Number.isFinite(directUserId ?? NaN)) {
        return NextResponse.json(
          { error: "Select a workspace member for the direct channel" },
          { status: 400 },
        );
      }

      if (directUserId === userId) {
        return NextResponse.json(
          { error: "Choose a different workspace member for direct channels" },
          { status: 400 },
        );
      }
    }

    let workspaceMember = false;
    let directWorkspaceMember = true;

    try {
      workspaceMember = await ensureWorkspaceMember(
        workspaceId,
        userId,
        "lower",
      );
      if (channelType === "direct" && directUserId !== null) {
        directWorkspaceMember = await ensureWorkspaceMember(
          workspaceId,
          directUserId,
          "lower",
        );
      }
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }

      workspaceMember = await ensureWorkspaceMember(
        workspaceId,
        userId,
        "upper",
      );
      if (channelType === "direct" && directUserId !== null) {
        directWorkspaceMember = await ensureWorkspaceMember(
          workspaceId,
          directUserId,
          "upper",
        );
      }
    }

    if (!workspaceMember) {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 403 },
      );
    }

    if (channelType === "direct" && !directWorkspaceMember) {
      return NextResponse.json(
        { error: "The selected member is not in this workspace" },
        { status: 400 },
      );
    }

    let channel: ChannelResponse | null = null;

    try {
      channel = await createChannel(
        workspaceId,
        name,
        channelType,
        description,
        userId,
        directUserId,
        "lower",
      );
    } catch (error: any) {
      if (error?.code === "42P01") {
        channel = await createChannel(
          workspaceId,
          name,
          channelType,
          description,
          userId,
          directUserId,
          "upper",
        );
      } else if (error?.code === "23505") {
        return NextResponse.json(
          {
            error: "A channel with this name already exists in this workspace",
          },
          { status: 409 },
        );
      } else {
        throw error;
      }
    }

    return NextResponse.json(channel, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 },
    );
  }
}
