import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseWorkspaceId = (value: string) => {
  const workspaceId = Number.parseInt(value, 10);
  return Number.isFinite(workspaceId) ? workspaceId : null;
};

// GET pending invitations for the logged-in user in this workspace
export async function GET(
  _request: Request,
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

    const result = await query(
      `
        SELECT
          wi.invitation_id AS id,
          wi.workspace_id AS "workspaceId",
          w.name AS "workspaceName",
          wi.inviter AS "inviterId",
          inviter.username AS "inviterUsername",
          wi.invitee AS "inviteeId",
          invitee.username AS "inviteeUsername",
          wi.status,
          wi.invited_at AS "invitedAt"
        FROM workspace_invitations wi
        JOIN workspaces w
          ON w.workspace_id = wi.workspace_id
        JOIN users inviter
          ON inviter.user_id = wi.inviter
        JOIN users invitee
          ON invitee.user_id = wi.invitee
        WHERE wi.workspace_id = $1
          AND wi.invitee = $2
          AND wi.status = 'pending'
        ORDER BY wi.invited_at DESC
      `,
      [workspaceId, userId],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("FETCH WORKSPACE INVITATIONS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch workspace invitations" },
      { status: 500 },
    );
  }
}

// POST create/send a workspace invitation
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

    const inviterId = Number(session.user.id);
    const body = await request.json();

    const identifier =
      typeof body?.identifier === "string" ? body.identifier.trim() : "";

    if (!identifier) {
      return NextResponse.json(
        { error: "Username or email is required" },
        { status: 400 },
      );
    }

    // Only workspace admins can invite users
    const adminCheck = await query(
      `
        SELECT 1
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
          AND is_admin = true
        LIMIT 1
      `,
      [workspaceId, inviterId],
    );

    if (adminCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Only workspace admins can invite users" },
        { status: 403 },
      );
    }

    // Find invitee by username or email
    const inviteeResult = await query(
      `
        SELECT user_id, username, email
        FROM users
        WHERE username = $1 OR email = $1
        LIMIT 1
      `,
      [identifier],
    );

    if (inviteeResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const invitee = inviteeResult.rows[0];

    if (invitee.user_id === inviterId) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
        { status: 400 },
      );
    }

    // Prevent inviting existing workspace members
    const existingMember = await query(
      `
        SELECT 1
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [workspaceId, invitee.user_id],
    );

    if (existingMember.rows.length > 0) {
      return NextResponse.json(
        { error: "User is already a workspace member" },
        { status: 409 },
      );
    }

    // Prevent duplicate pending invitations
    const existingInvite = await query(
      `
        SELECT 1
        FROM workspace_invitations
        WHERE workspace_id = $1
          AND invitee = $2
          AND status = 'pending'
        LIMIT 1
      `,
      [workspaceId, invitee.user_id],
    );

    if (existingInvite.rows.length > 0) {
      return NextResponse.json(
        { error: "User already has a pending invitation" },
        { status: 409 },
      );
    }

    const inviteResult = await query(
      `
        INSERT INTO workspace_invitations (
          workspace_id,
          inviter,
          invitee
        )
        VALUES ($1, $2, $3)
        RETURNING
          invitation_id AS id,
          workspace_id AS "workspaceId",
          inviter AS "inviterId",
          invitee AS "inviteeId",
          status,
          invited_at AS "invitedAt"
      `,
      [workspaceId, inviterId, invitee.user_id],
    );

    return NextResponse.json(inviteResult.rows[0], { status: 201 });
  } catch (error) {
    console.error("CREATE WORKSPACE INVITATION ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create workspace invitation" },
      { status: 500 },
    );
  }
}