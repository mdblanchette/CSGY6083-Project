import { NextResponse } from "next/server";
import { query } from "@/libs/db";
import { getAuthSession } from "@/libs/auth";

export const runtime = "nodejs";

type WorkspaceRow = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  isAdmin?: boolean;
};

const selectWorkspaces = async (userId: number) => {
  try {
    const result = await query(
      `
        SELECT
          w.workspace_id AS id,
          w.name,
          w.description,
          w.created_at AS "createdAt",
          wm.is_admin AS "isAdmin"
        FROM workspaces w
        JOIN workspace_members wm
          ON wm.workspace_id = w.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
      `,
      [userId],
    );

    return result.rows as WorkspaceRow[];
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }

    const fallback = await query(
      `
        SELECT
          w.workspace_id AS id,
          w.name,
          w.description,
          w.created_at AS "createdAt",
          wm.is_admin AS "isAdmin"
        FROM "Workspaces" w
        JOIN "Workspace_Members" wm
          ON wm.workspace_id = w.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
      `,
      [userId],
    );

    return fallback.rows as WorkspaceRow[];
  }
};

const insertWorkspace = async (
  name: string,
  description: string | null,
  createdBy: number,
) => {
  try {
    const result = await query(
      `
        INSERT INTO workspaces (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING workspace_id AS id, name, description, created_at AS "createdAt"
      `,
      [name, description, createdBy],
    );

    const row = result.rows[0] as WorkspaceRow;

    await query(
      `
        INSERT INTO workspace_members (workspace_id, user_id, is_admin, is_owner)
        VALUES ($1, $2, true, true)
      `,
      [row.id, createdBy],
    );

    return {
      ...row,
      isAdmin: true,
      isOwner: true,
    };
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }

    const fallback = await query(
      `
        INSERT INTO "Workspaces" (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING workspace_id AS id, name, description, created_at AS "createdAt"
      `,
      [name, description, createdBy],
    );

    const row = fallback.rows[0] as WorkspaceRow;

    await query(
      `
        INSERT INTO "Workspace_Members" (workspace_id, user_id, is_admin, is_owner)
        VALUES ($1, $2, true, true)
      `,
      [row.id, createdBy],
    );

    return {
      ...row,
      isAdmin: true,
      isOwner: true,
    };
  }
};

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const workspaces = await selectWorkspaces(userId);

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("FETCH WORKSPACES ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
  // try to determine the authenticated user and add them as admin
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    const body = await request.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";

    const description =
      typeof body?.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const workspace = await insertWorkspace(name, description, userId);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("CREATE WORKSPACE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}