import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role, TaskStatus, Priority } from "../src/generated/prisma/enums";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required for seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash("Admin123!", 12);
  const memberHash = await bcrypt.hash("Member123!", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Alex Admin",
      email: "admin@example.com",
      password: adminHash,
      role: Role.ADMIN,
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "Taylor Member",
      email: "member@example.com",
      password: memberHash,
      role: Role.MEMBER,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Product launch",
      description: "Cross-team initiative for Q2 release.",
      createdById: admin.id,
      members: {
        create: [{ userId: admin.id }, { userId: member.id }],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Draft announcement",
        description: "Internal and external comms plan.",
        status: TaskStatus.COMPLETED,
        priority: Priority.HIGH,
        projectId: project.id,
        assignedToId: member.id,
        dueDate: new Date(Date.now() - 86400000),
      },
      {
        title: "QA regression suite",
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        projectId: project.id,
        assignedToId: member.id,
        dueDate: new Date(Date.now() + 86400000 * 3),
      },
      {
        title: "Stakeholder review",
        status: TaskStatus.PENDING,
        priority: Priority.LOW,
        projectId: project.id,
        assignedToId: admin.id,
        dueDate: new Date(Date.now() - 86400000 * 2),
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "SEED",
        entity: "Database",
        metadata: { message: "Demo data loaded" },
      },
    ],
  });

  console.log("Seed finished. demo logins:");
  console.log("  admin@example.com / Admin123!");
  console.log("  member@example.com / Member123!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
