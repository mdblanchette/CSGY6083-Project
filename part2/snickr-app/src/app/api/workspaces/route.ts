import { NextResponse } from "next/server";
import { query } from "@/libs/db";

export const runtime = "nodejs";

type WorkspaceRow = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
};

const selectWorkspaces = async () => {
  try {
    const result = await query(
      `
        SELECT
          workspace_id AS id,
          name,
          description,
          created_at AS "createdAt"
        FROM workspaces
        ORDER BY created_at DESC
      `,
    );

    return result.rows as WorkspaceRow[];
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }

    const fallback = await query(
      `
        SELECT
          workspace_id AS id,
          name,
          description,
          created_at AS "createdAt"
        FROM "Workspace"
        ORDER BY created_at DESC
      `,
    );

    return fallback.rows as WorkspaceRow[];
  }
};

const insertWorkspace = async (name: string, description: string | null) => {
  try {
    const result = await query(
      `
        INSERT INTO workspaces (name, description)
        VALUES ($1, $2)
        RETURNING workspace_id AS id, name, description, created_at AS "createdAt"
      `,
      [name, description],
    );

    return result.rows[0] as WorkspaceRow;
  } catch (error: any) {
    if (error?.code !== "42P01") {
      throw error;
    }

    const fallback = await query(
      `
        INSERT INTO "Workspace" (name, description)
        VALUES ($1, $2)
        RETURNING workspace_id AS id, name, description, created_at AS "createdAt"
      `,
      [name, description],
    );

    return fallback.rows[0] as WorkspaceRow;
  }
};

export async function GET() {
  try {
    const workspaces = await selectWorkspaces();
    return NextResponse.json(workspaces);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const workspace = await insertWorkspace(name, description);
    return NextResponse.json(workspace, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}
