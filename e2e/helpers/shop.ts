import { admin } from "./members"

/** The items placed for the member, as the server has them. */
export async function placedItems(
  userId: string
): Promise<Record<string, string>> {
  const { data, error } = await admin()
    .from("lobby_placements")
    .select("slot, item_id")
    .eq("user_id", userId)
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.slot, row.item_id]))
}
