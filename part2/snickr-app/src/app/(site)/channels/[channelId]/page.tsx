import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DefaultLayout from "@/components/Layouts/DefaultLaout";
import { getAuthSession } from "@/libs/auth";
import {
  addChannelMembership,
  getVisibleWorkspaceChannels,
  resolveChannelAccess,
} from "@/libs/channel-access";
import { query } from "@/libs/db";

export const metadata: Metadata = {
  title: "Channel | Snickr",
  description: "Workspace channel view",
};

type ChannelPageData = {
  workspace: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
  };
  channel: {
    id: number;
    name: string;
    type: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
    messageCount: number;
  };
  channels: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  members: Array<{
    id: number;
    email: string;
    username: string;
    nickname: string | null;
    isAdmin: boolean;
    joinedAt: string;
  }>;
  messages: Array<{
    id: number;
    body: string;
    postedAt: string;
    senderName: string | null;
    senderEmail: string | null;
  }>;
};

const parseId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getTables = (schema: "lower" | "upper") => {
  return schema === "lower"
    ? {
        workspaces: "workspaces",
        channels: "channels",
        workspaceMembers: "workspace_members",
        users: "users",
        channelMembers: "channel_members",
        messages: "messages",
      }
    : {
        workspaces: '"Workspaces"',
        channels: '"Channels"',
        workspaceMembers: '"Workspace_Members"',
        users: '"Users"',
        channelMembers: '"Channel_Members"',
        messages: '"Messages"',
      };
};

const buildChannelPageData = async (
  channelId: number,
  userId: number,
  schema: "lower" | "upper",
) => {
  const tables = getTables(schema);

  const access = await resolveChannelAccess(channelId, userId, schema);

  if (!access) {
    return null;
  }

  if (!access.canView) {
    return null;
  }

  if (access.shouldAutoJoin) {
    await addChannelMembership(channelId, userId, schema);
  }

  const channelResult = await query(
    `
      SELECT
        c.channel_id AS id,
        c.workspace_id AS "workspaceId",
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

  const channel = channelResult.rows[0] as ChannelPageData["channel"] & {
    workspaceId: number;
  };

  const workspaceResult = await query(
    `
      SELECT
        workspace_id AS id,
        name,
        description,
        created_at AS "createdAt"
      FROM ${tables.workspaces}
      WHERE workspace_id = $1
      LIMIT 1
    `,
    [channel.workspaceId],
  );

  if (workspaceResult.rows.length === 0) {
    return null;
  }

  const channelsResult = await getVisibleWorkspaceChannels(
    channel.workspaceId,
    userId,
    schema,
  );

  const membersResult = await query(
    `
      SELECT
        u.user_id AS id,
        u.email,
        u.username,
        u.nickname,
        cm.is_admin AS "isAdmin",
        cm.joined_at AS "joinedAt"
      FROM ${tables.channelMembers} cm
      INNER JOIN ${tables.users} u
        ON u.user_id = cm.user_id
      WHERE cm.channel_id = $1
      ORDER BY cm.is_admin DESC, cm.joined_at ASC
    `,
    [channelId],
  );

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
      LIMIT 10
    `,
    [channelId],
  );

  return {
    workspace: workspaceResult.rows[0],
    channel,
    channels: channelsResult,
    members: membersResult.rows,
    messages: messagesResult.rows,
  } as ChannelPageData;
};

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId: channelIdParam } = await params;
  const channelId = parseId(channelIdParam);

  if (channelId === null) {
    notFound();
  }

  const session = await getAuthSession();
  if (!session?.user?.id) {
    notFound();
  }

  const userId = Number.parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    notFound();
  }

  let data: ChannelPageData | null = null;

  try {
    data = await buildChannelPageData(channelId, userId, "lower");
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }
  }

  if (!data) {
    try {
      data = await buildChannelPageData(channelId, userId, "upper");
    } catch (error: any) {
      if (error?.code !== "42P01") {
        throw error;
      }
    }
  }

  if (!data) {
    notFound();
  }

  return (
    <DefaultLayout>
      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <aside className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-stroke px-3 py-1.5 text-sm font-medium text-dark transition hover:border-primary hover:text-primary dark:border-stroke-dark dark:text-dark-6"
          >
            <span aria-hidden="true">←</span>
            Back to workspace
          </Link>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {data.workspace.name}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              #{data.channel.name}
            </h1>
            <p className="mt-3 text-dark-4 dark:text-dark-6">
              {data.channel.description ||
                "This channel is ready for discussion inside its workspace."}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark">
              <p className="text-sm text-dark-4 dark:text-dark-6">Type</p>
              <p className="mt-1 font-semibold text-dark dark:text-white">
                {data.channel.type}
              </p>
            </div>
            <div className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark">
              <p className="text-sm text-dark-4 dark:text-dark-6">Members</p>
              <p className="mt-1 font-semibold text-dark dark:text-white">
                {data.channel.memberCount}
              </p>
            </div>
            <div className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark">
              <p className="text-sm text-dark-4 dark:text-dark-6">Messages</p>
              <p className="mt-1 font-semibold text-dark dark:text-white">
                {data.channel.messageCount}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-dark dark:text-white">
              Channels
            </h2>
            <div className="mt-3 space-y-2">
              {data.channels.map((channel) => {
                const isActive = channel.id === data.channel.id;

                return (
                  <Link
                    key={channel.id}
                    href={`/channels/${channel.id}`}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-stroke text-dark hover:border-primary hover:bg-gray-2 dark:border-stroke-dark dark:text-dark-6 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate font-medium">
                      #{channel.name}
                    </span>
                    <span className="ml-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-4 dark:bg-gray-dark dark:text-dark-6">
                      {channel.type}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
                  Channel overview
                </p>
                <h2 className="mt-2 text-2xl font-bold text-dark dark:text-white">
                  #{data.channel.name}
                </h2>
                <p className="mt-3 text-dark-4 dark:text-dark-6">
                  Created{" "}
                  {new Date(data.channel.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="rounded-2xl border border-stroke bg-gray-2 px-4 py-3 text-right dark:border-stroke-dark dark:bg-white/5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-dark-4 dark:text-dark-6">
                  Workspace
                </p>
                <p className="mt-1 text-sm font-semibold text-dark dark:text-white">
                  {data.workspace.name}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-stroke p-6 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
              Messages are available through the database and can be wired into
              a live conversation view from here.
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Recent messages
              </h3>
              <div className="mt-3 space-y-3">
                {data.messages.length > 0 ? (
                  data.messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-dark dark:text-white">
                          {message.senderName ||
                            message.senderEmail ||
                            "System"}
                        </p>
                        <p className="text-xs text-dark-4 dark:text-dark-6">
                          {new Date(message.postedAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-3 text-dark-4 dark:text-dark-6">
                        {message.body}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-stroke p-6 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6">
                    No messages yet in this channel.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Channel members
              </h3>
              <span className="rounded-full bg-gray-2 px-3 py-1 text-xs font-semibold text-dark-4 dark:bg-white/5 dark:text-dark-6">
                {data.members.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.members.length > 0 ? (
                data.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-stroke p-4 dark:border-stroke-dark"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-dark dark:text-white">
                          {member.nickname || member.username}
                        </p>
                        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
                          {member.email}
                        </p>
                      </div>
                      {member.isAdmin && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-dark-4 dark:text-dark-6">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-stroke p-6 text-sm text-dark-4 dark:border-stroke-dark dark:text-dark-6 md:col-span-2">
                  This channel does not have members yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
