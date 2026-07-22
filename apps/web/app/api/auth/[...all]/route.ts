import { getAuth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";

function handlers() {
  return toNextJsHandler(getAuth());
}

export function GET(request: Request) {
  return handlers().GET(request);
}

export function POST(request: Request) {
  return handlers().POST(request);
}
