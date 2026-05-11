import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
};

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      workspaceId: string;
      invitationId: string;
    }>;
  },
) {
  try {
    const { workspaceId: workspaceIdParam, invitationId: invitationIdParam } =
      await context.params;

    const workspaceId = parseId(workspaceIdParam);
    const invitationId = parseId(invitationIdParam);

    if (workspaceId === null || invitationId === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const body = await request.json();
    const action = body?.action;

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be accept or decline" },
        { status: 400 },
      );
    }

    const inviteResult = await query(
      `
        SELECT invitation_id, workspace_id, invitee, status
        FROM workspace_invitations
        WHERE invitation_id = $1
          AND workspace_id = $2
          AND invitee = $3
        LIMIT 1
      `,
      [invitationId, workspaceId, userId],
    );

    if (inviteResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    const invitation = inviteResult.rows[0];

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation is no longer pending" },
        { status: 409 },
      );
    }

    if (action === "decline") {
      const declinedResult = await query(
        `
          UPDATE workspace_invitations
          SET status = 'declined'
          WHERE invitation_id = $1
          RETURNING invitation_id AS id, status
        `,
        [invitationId],
      );

      return NextResponse.json(declinedResult.rows[0]);
    }

    await query("BEGIN");

    try {
      await query(
        `
          INSERT INTO workspace_members (
            workspace_id,
            user_id,
            is_admin
          )
          VALUES ($1, $2, false)
          ON CONFLICT (workspace_id, user_id) DO NOTHING
        `,
        [workspaceId, userId],
      );

      const acceptedResult = await query(
        `
          UPDATE workspace_invitations
          SET status = 'accepted'
          WHERE invitation_id = $1
          RETURNING invitation_id AS id, status
        `,
        [invitationId],
      );

      await query("COMMIT");

      return NextResponse.json(acceptedResult.rows[0]);
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("RESPOND WORKSPACE INVITATION ERROR:", error);

    return NextResponse.json(
      { error: "Failed to respond to invitation" },
      { status: 500 },
    );
  }
}