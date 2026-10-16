import { getGenreRecommendations } from "@/lib/advanced-recommendations"
import { requireAuth } from "@/lib/auth-utils"
import { isNeo4jConfigured } from "@/lib/neo4j"

export async function GET() {
  try {
    if (!isNeo4jConfigured()) return Response.json({ genres: [] })
    const user = await requireAuth()
    const genres = await getGenreRecommendations(user.id)
    return Response.json({ genres })
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error getting genre recommendations:", error)
    return Response.json({ genres: [] })
  }
}
