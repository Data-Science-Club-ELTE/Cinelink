import { runQuery, formatMovieFromNeo4j, isNeo4jConfigured } from "./neo4j"
import neo4j from "neo4j-driver"

// Get advanced recommendations using a hybrid approach
export async function getAdvancedRecommendations(userId = "current-user", count = 20) {
  if (!isNeo4jConfigured()) return []
  try {
    // Check if user has any ratings
    const userRatingsQuery = `
      MATCH (u:User {id: $userId})-[r:RATED]->()
      RETURN count(r) as ratingCount
    `
    const userRatingsResult = await runQuery(userRatingsQuery, { userId })
    const ratingCount = userRatingsResult[0]?.ratingCount || 0

    // If user has no ratings, return popular movies
    if (ratingCount === 0) {
      const popularMoviesQuery = `
        MATCH (m:Movie)
        WHERE m.voteAverage IS NOT NULL
        OPTIONAL MATCH (m)-[:IN_GENRE]->(g:Genre)
        WITH m, collect(g.name) as genres
        RETURN m.id as id, m.title as title, m.releaseYear as releaseYear,
               m.imageUrl as imageUrl, m.synopsis as synopsis, genres,
               m.voteAverage as voteAverage
        ORDER BY m.voteAverage DESC, coalesce(m.voteCount, 0) DESC
        LIMIT $count
      `

      const records = await runQuery(popularMoviesQuery, { count: neo4j.int(count) })
      return records.map((r) => formatMovieFromNeo4j({ ...r, genre: r.genres }))
    }

    // Hybrid recommendation approach
    const hybridQuery = `
      // Find movies the user has rated highly
      MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)
      WHERE r.rating >= 4

      // Find genres the user likes
      MATCH (m)-[:IN_GENRE]->(g:Genre)
      WITH u, g, count(*) as genreWeight

      // Content-based: Find movies with those genres
      MATCH (rec:Movie)-[:IN_GENRE]->(g)
      WHERE NOT EXISTS { MATCH (u)-[:RATED]->(rec) }

      // Calculate content-based score
      WITH u, rec, sum(genreWeight) as contentScore

      // Collaborative filtering: Find similar users
      OPTIONAL MATCH (u)-[r1:RATED]->(m:Movie)<-[r2:RATED]-(similarUser:User)
      WHERE abs(r1.rating - r2.rating) <= 1
      WITH u, rec, contentScore, similarUser, count(m) as moviesInCommon
      WHERE moviesInCommon >= 3

      // Find what similar users rated highly
      OPTIONAL MATCH (similarUser)-[r3:RATED]->(rec)
      WHERE r3.rating >= 4

      // Calculate collaborative score
      WITH rec, contentScore, count(r3) as collaborativeScore

      // Get movie details
      OPTIONAL MATCH (rec)-[:IN_GENRE]->(genre:Genre)
      WITH rec, contentScore, collaborativeScore, collect(genre.name) as genres

      // Calculate hybrid score (weighted)
      WITH rec, genres,
           (contentScore * 0.7) + (collaborativeScore * 0.3) as hybridScore

      // Return recommendations
      RETURN rec.id as id, rec.title as title, rec.releaseYear as releaseYear,
             rec.imageUrl as imageUrl, rec.synopsis as synopsis, genres,
             rec.voteAverage as voteAverage, hybridScore as score
      ORDER BY score DESC, rec.voteAverage DESC
      LIMIT $count
    `

    const records = await runQuery(hybridQuery, { userId, count: neo4j.int(count) })
    return records.map((r) => formatMovieFromNeo4j({ ...r, genre: r.genres }))
  } catch (error) {
    console.error("Error getting advanced recommendations:", error)
    throw error
  }
}

// Get similar movies to a specific movie
export async function getSimilarMovies(movieId, count = 6) {
  try {
    const query = `
      // Find the target movie
      MATCH (m:Movie {id: $movieId})

      // Find its genres
      MATCH (m)-[:IN_GENRE]->(g:Genre)

      // Find similar movies by genre
      MATCH (similar:Movie)-[:IN_GENRE]->(g)
      WHERE similar.id <> $movieId

      // Calculate similarity score
      WITH similar, count(g) as genreOverlap

      // Get movie details
      OPTIONAL MATCH (similar)-[:IN_GENRE]->(genre:Genre)
      WITH similar, genreOverlap, collect(genre.name) as genres

      // Return similar movies
      RETURN similar.id as id, similar.title as title,
             similar.releaseYear as releaseYear,
             similar.imageUrl as imageUrl, similar.synopsis as synopsis,
             genres, similar.voteAverage as voteAverage
      ORDER BY genreOverlap DESC, similar.voteAverage DESC
      LIMIT $count
    `

    const records = await runQuery(query, { movieId: neo4j.int(Number.parseInt(movieId)), count: neo4j.int(count) })
    return records.map(formatMovieFromNeo4j)
  } catch (error) {
    console.error(`Error finding similar movies to ${movieId}:`, error)
    throw error
  }
}

// Get personalized genre recommendations
export async function getGenreRecommendations(userId = "current-user") {
  if (!isNeo4jConfigured()) return []
  try {
    const query = `
      // Find genres the user has rated highly
      MATCH (u:User {id: $userId})-[r:RATED]->(m:Movie)-[:IN_GENRE]->(g:Genre)
      WHERE r.rating >= 4
      WITH g, count(*) as genreCount, avg(r.rating) as avgRating

      // Return top genres
      RETURN g.name as genre, genreCount, avgRating
      ORDER BY genreCount DESC, avgRating DESC
      LIMIT 5
    `

    const records = await runQuery(query, { userId })
    return records.map((record) => ({
      genre: record.genre,
      count: record.genreCount,
      averageRating: record.avgRating,
    }))
  } catch (error) {
    console.error("Error getting genre recommendations:", error)
    throw error
  }
}
