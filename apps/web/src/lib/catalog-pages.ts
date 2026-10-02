import "server-only";
import { notFound } from "next/navigation";
import { DomainError } from "@africacod/domain";
import { z } from "zod";
export async function found<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (
      (error instanceof DomainError && error.code === "NOT_FOUND") ||
      error instanceof z.ZodError
    )
      notFound();
    throw error;
  }
}
export function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
