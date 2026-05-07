import type { Role } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
};
