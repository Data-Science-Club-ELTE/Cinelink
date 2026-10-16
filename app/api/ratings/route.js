import { runQuery, isNeo4jConfigured } from "@/lib/neo4j"
import neo4j from "neo4j-driver"
import { requireAuth } from "@/lib/auth-utils"

export async function POST(request) {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isNeo4jConfigured()) {
      return Response.json({ error: "Database not available" }, { status: 503 })
    }
    const userId = user.id

    const body = await request.json()

    // Parse and validate movieId and rating
    const movieId = Number(body.movieId)
    const rating = body.rating

    // Validate movieId
    if (!Number.isSafeInteger(movieId) || movieId === 0) {
      return Response.json({
        error: "Invalid movie ID"
      }, { status: 400 })
    }

    // Validate rating (0-5, where 0 means delete)
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 5) {
      return Response.json({
        error: "Rating must be between 0 and 5"
      }, { status: 400 })
    }

    // If rating is 0, delete the rating
    if (rating === 0) {
      const deleteQuery = `
        MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie {id: $movieId})
        DELETE r
        RETURN count(r) as deleted
      `
      await runQuery(deleteQuery, {
        userId,
        movieId: neo4j.int(movieId)
      })
      return Response.json({ success: true, action: "deleted" })
    }

    // Save the rating (1-5)
    // Use MATCH for Movie so we never create ghost nodes without genre relationships
    const query = `
      MATCH (m:Movie {id: $movieId})
      MATCH (u:User {id: $userId})
      MERGE (u)-[r:RATED]->(m)
      SET r.rating = $rating,
          r.timestamp = timestamp()
      RETURN r.rating as rating
    `

    const result = await runQuery(query, {
      userId,
      movieId: neo4j.int(movieId),
      rating: parseFloat(rating)
    })

    if (result.length === 0) {
      return Response.json({ error: "Movie not found" }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("Error saving rating:", error)
    return Response.json({ error: "Failed to save rating" }, { status: 500 })
  }
}

export async function GET() {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isNeo4jConfigured()) {
      return Response.json({ ratings: [] })
    }
    const userId = user.id

    const query = `
      MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)
      RETURN m.id as movieId, r.rating as rating
      ORDER BY r.timestamp DESC
    `

    const records = await runQuery(query, { userId })
    const ratings = records.map((record) => ({
      movieId: record.movieId,
      rating: record.rating,
    }))

    return Response.json({ ratings })
  } catch (error) {
    console.error("Error fetching ratings:", error)
    return Response.json({ ratings: [] })
  }
}

export async function DELETE() {
  try {
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isNeo4jConfigured()) {
      return Response.json({ success: true, deletedCount: 0 })
    }
    const userId = user.id

    const query = `
      MATCH (u:User {id: $userId})-[r:RATED]->()
      DELETE r
      RETURN count(r) as deletedCount
    `

    const result = await runQuery(query, { userId })
    const deletedCount = result[0]?.deletedCount || 0

    return Response.json({ success: true, deletedCount })
  } catch (error) {
    console.error("Error clearing ratings:", error)
    return Response.json({ success: true, deletedCount: 0 })
  }
}
