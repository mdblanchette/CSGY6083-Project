import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

type ChannelResponse = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
};

const parseWorkspaceId = (value: string) => {
  const workspaceId = Number.parseInt(value, 10);
  return Number.isFinite(workspaceId) ? workspaceId : null;
};

const createChannel = async (
  workspaceId: number,
  name: string,
  channelType: string,
  description: string | null,
  createdBy: number | null,
  schema: "lower" | "upper",
) => {
  const tables =
    schema === "lower"
      ? {
          channels: "channels",
          channelMembers: "channel_members",
        }
      : {
          channels: '"Channels"',
          channelMembers: '"Channel_Members"',
        };

  const result = await query(
    `
      INSERT INTO ${tables.channels} (workspace_id, name, channel_type, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING channel_id AS id, name, channel_type AS type, description, created_at AS "createdAt"
    `,
    [workspaceId, name, channelType, description, createdBy],
  );

  const row = result.rows[0] as ChannelResponse;

  // Add creator as channel member and admin
  if (createdBy) {
    try {
      await query(
        `
          INSERT INTO ${tables.channelMembers} (channel_id, user_id, is_admin)
          VALUES ($1, $2, true)
        `,
        [row.id, createdBy],
      );
    } catch (e: any) {
      // ignore - best effort
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

    const userId = Number(session.user.id);
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

    // Validate input
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

    // Check that user is a member of the workspace
    try {
      const memberResult = await query(
        `
          SELECT 1 FROM workspace_members
          WHERE workspace_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [workspaceId, userId],
      );

      if (memberResult.rows.length === 0) {
        return NextResponse.json(
          { error: "You are not a member of this workspace" },
          { status: 403 },
        );
      }
    } catch (error: any) {
      if (error?.code === "42P01") {
        // Table doesn't exist in lowercase, try uppercase
        const memberResult = await query(
          `
            SELECT 1 FROM "Workspace_Members"
            WHERE workspace_id = $1 AND user_id = $2
            LIMIT 1
          `,
          [workspaceId, userId],
        );

        if (memberResult.rows.length === 0) {
          return NextResponse.json(
            { error: "You are not a member of this workspace" },
            { status: 403 },
          );
        }
      } else {
        throw error;
      }
    }

    let channel = null;

    try {
      channel = await createChannel(
        workspaceId,
        name,
        channelType,
        description,
        userId,
        "lower",
      );
    } catch (error: any) {
      if (error?.code === "42P01") {
        // Table doesn't exist in lowercase, try uppercase
        channel = await createChannel(
          workspaceId,
          name,
          channelType,
          description,
          userId,
          "upper",
        );
      } else if (error?.code === "23505") {
        // Unique constraint violation - channel name already exists in this workspace
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
