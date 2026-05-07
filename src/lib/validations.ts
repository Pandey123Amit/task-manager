import { z } from "zod";

const emailSchema = z.string().trim().min(1).email("Invalid email address");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const taskStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.string().max(40).optional().nullable(),
  projectId: z.string().min(1),
  assignedToId: z.string().min(1).optional().nullable(),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.string().max(40).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
});

export const memberEmailSchema = z.object({
  email: emailSchema,
});

export const memberTaskStatusSchema = z
  .object({ status: taskStatusSchema })
  .strict();

export const taskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().trim().max(200).optional(),
  projectId: z.string().min(1).optional(),
});

export function normalizeDueDate(input: string | null | undefined):
  | { ok: true; value: Date | null | undefined }
  | { ok: false; message: string } {
  if (input === undefined) return { ok: true, value: undefined };
  if (input === null || input.trim() === "")
    return { ok: true, value: null };
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: "Invalid due date" };
  }
  return { ok: true, value: d };
}
