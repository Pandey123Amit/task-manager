import { ZodError } from "zod";

export function jsonError(message: string, status: number, issues?: unknown) {
  return Response.json(
    { error: message, ...(issues !== undefined ? { issues } : {}) },
    { status },
  );
}

export function jsonZodError(err: ZodError) {
  return Response.json(
    {
      error: "Validation failed",
      issues: err.flatten(),
    },
    { status: 400 },
  );
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
