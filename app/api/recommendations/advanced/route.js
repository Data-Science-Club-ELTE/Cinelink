import { getAdvancedRecommendations } from "@/lib/advanced-recommendations"
import { requireAuth } from "@/lib/auth-utils"
import { isNeo4jConfigured } from "@/lib/neo4j"

export async function GET(request) {
  try {
    const user = await requireAuth()
    if (!isNeo4jConfigured()) return Response.json({ recommendations: [] })

    const { searchParams } = new URL(request.url)
    const count = Number.parseInt(searchParams.get("count") || "20")

    const recommendations = await getAdvancedRecommendations(user.id, count)
    return Response.json({ recommendations })
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error generating advanced recommendations:", error)
    return Response.json({ recommendations: [] })
  }
}
