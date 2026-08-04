import { createAuth } from "@/lib/auth/server";

async function handle(request: Request): Promise<Response> {
  return createAuth().handler(request);
}

export const GET = handle;
export const POST = handle;
