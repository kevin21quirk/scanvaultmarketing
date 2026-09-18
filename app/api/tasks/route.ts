import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { taskSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = taskSchema.parse(body);
    const task = await prisma.task.create({
      data: { ...data, assignedToId: data.assignedToId || user.id },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error("Create task error", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
