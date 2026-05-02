export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}
