import packageMetadata from "../../../../package.json";

export function GET(): Response {
  return Response.json(
    { status: "ok", version: packageMetadata.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
