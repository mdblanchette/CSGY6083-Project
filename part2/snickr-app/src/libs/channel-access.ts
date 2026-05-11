import { query } from "@/libs/db";

export type ChannelSchema = "lower" | "upper";

type ChannelTables = {
  channels: string;
  workspaceMembers: string;
  channelMembers: string;
  channelInvitations: string;
  messages: string;
};

export type ChannelAccess = {
  channel: {
    id: number;
    workspaceId: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    createdBy: number | null;
  };
  isWorkspaceMember: boolean;
  isChannelMember: boolean;
  isInvited: boolean;
  canView: boolean;
  shouldAutoJoin: boolean;
};

export type VisibleChannel = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  messageCount: number;
};

const getTables = (schema: ChannelSchema): ChannelTables => {
  return schema === "lower"
    ? {
        channels: "channels",
        workspaceMembers: "workspace_members",
        channelMembers: "channel_members",
        channelInvitations: "channel_invitations",
        messages: "messages",
      }
    : {
        channels: '"Channels"',
        workspaceMembers: '"Workspace_Members"',
        channelMembers: '"Channel_Members"',
        channelInvitations: '"Channel_Invitations"',
        messages: '"Messages"',
      };
};

export const resolveChannelAccess = async (
  channelId: number,
  userId: number,
  schema: ChannelSchema,
): Promise<ChannelAccess | null> => {
  const tables = getTables(schema);

  const channelResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.workspace_id AS "workspaceId",
        c.name,
        c.channel_type AS type,
        c.description,
        c.created_at AS "createdAt",
        c.created_by AS "createdBy"
      FROM ${tables.channels} c
      WHERE c.channel_id = $1
      LIMIT 1
    `,
    [channelId],
  );

  if (channelResult.rows.length === 0) {
    return null;
  }

  const channel = channelResult.rows[0] as ChannelAccess["channel"];

  const workspaceMemberResult = await query(
    `
      SELECT 1
      FROM ${tables.workspaceMembers}
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [channel.workspaceId, userId],
  );

  const isWorkspaceMember = workspaceMemberResult.rows.length > 0;

  const channelMemberResult = await query(
    `
      SELECT 1
      FROM ${tables.channelMembers}
      WHERE channel_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [channelId, userId],
  );

  const isChannelMember = channelMemberResult.rows.length > 0;

  const invitationResult = await query(
    `
      SELECT 1
      FROM ${tables.channelInvitations} ci
      WHERE ci.channel_id = $1
        AND ci.invitee = $2
        AND ci.status <> 'declined'
        AND ($3::int IS NULL OR ci.inviter = $3)
      LIMIT 1
    `,
    [channelId, userId, channel.createdBy],
  );

  const isInvited = invitationResult.rows.length > 0;
  const isPublicChannel = channel.type === "public";
  const isPrivateChannel = channel.type === "private";
  const isDirectChannel = channel.type === "direct";

  const canView =
    isWorkspaceMember &&
    (isPublicChannel ||
      (isPrivateChannel && (isChannelMember || isInvited)) ||
      (isDirectChannel && isChannelMember));

  return {
    channel,
    isWorkspaceMember,
    isChannelMember,
    isInvited,
    canView,
    shouldAutoJoin:
      canView && !isChannelMember && (isPublicChannel || isPrivateChannel),
  };
};

export const addChannelMembership = async (
  channelId: number,
  userId: number,
  schema: ChannelSchema,
) => {
  const tables = getTables(schema);

  await query(
    `
      INSERT INTO ${tables.channelMembers} (channel_id, user_id, is_admin)
      VALUES ($1, $2, false)
      ON CONFLICT (channel_id, user_id) DO NOTHING
    `,
    [channelId, userId],
  );
};

export const getVisibleWorkspaceChannels = async (
  workspaceId: number,
  userId: number,
  schema: ChannelSchema,
): Promise<VisibleChannel[]> => {
  const tables = getTables(schema);

  const result = await query(
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
      WHERE c.workspace_id = $1
        AND EXISTS (
          SELECT 1
          FROM ${tables.workspaceMembers} wm
          WHERE wm.workspace_id = c.workspace_id
            AND wm.user_id = $2
        )
        AND (
          c.channel_type = 'public'
          OR (
            c.channel_type = 'private'
            AND (
              EXISTS (
                SELECT 1
                FROM ${tables.channelMembers} cm
                WHERE cm.channel_id = c.channel_id
                  AND cm.user_id = $2
              )
              OR EXISTS (
                SELECT 1
                FROM ${tables.channelInvitations} ci
                WHERE ci.channel_id = c.channel_id
                  AND ci.invitee = $2
                  AND ci.status <> 'declined'
                  AND (c.created_by IS NULL OR ci.inviter = c.created_by)
              )
            )
          )
          OR (
            c.channel_type = 'direct'
            AND EXISTS (
              SELECT 1
              FROM ${tables.channelMembers} cm
              WHERE cm.channel_id = c.channel_id
                AND cm.user_id = $2
            )
          )
        )
      ORDER BY c.created_at ASC
    `,
    [workspaceId, userId],
  );

  return result.rows as VisibleChannel[];
};
