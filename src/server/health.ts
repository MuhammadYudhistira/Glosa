/**
 * Body of GET /api/health (spec 1E §5): the app is up and runs this image.
 * It never touches the database, so the app and Supabase are watched apart.
 */
export function healthResponse(version: string | undefined): Response {
  return Response.json(
    { status: "ok", version: version || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
