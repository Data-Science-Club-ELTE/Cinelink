import neo4j from "neo4j-driver"

// Get Neo4j connection details from environment variables
const URI = process.env.NEO4J_URI
const USER = process.env.NEO4J_USER || process.env.NEO4J_USERNAME
const PASSWORD = (process.env.NEO4J_PASSWORD || "").trim()

let driver

export function isNeo4jConfigured() {
  return !!(URI && USER && PASSWORD)
}

// Call this once at runtime to confirm env is loaded (does not log secrets)
export function logNeo4jConfigStatus() {
  const hasUri = !!URI
  const hasUser = !!USER
  const hasPassword = !!PASSWORD
  const userLen = (USER || "").length
  console.log(
    "[Neo4j] Config: URI=" + hasUri + ", USER=" + hasUser + " (length " + userLen + "), PASSWORD set=" + hasPassword
  )
}

// Get or create the Neo4j driver instance
export function getDriver() {
  if (!driver) {
    logNeo4jConfigStatus()
    if (!isNeo4jConfigured()) {
      throw new Error("Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env.local")
    }
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 5000,
      connectionTimeout: 8000,
      disableLosslessIntegers: true,
    })
  }
  return driver
}

// Close the Neo4j driver
export async function closeDriver() {
  if (driver) {
    await driver.close()
    driver = null
  }
}

const QUERY_TIMEOUT_MS = 15000

// Helper function to run a Cypher query (with timeout to avoid long hangs)
export async function runQuery(query, params = {}) {
  const driver = getDriver()
  const session = driver.session()

  try {
    const result = await session.run(query, params, { timeout: QUERY_TIMEOUT_MS })
    return result.records.map((record) => {
      // Convert Neo4j types to JavaScript types
      const obj = {}
      for (const [key, value] of Object.entries(record.toObject())) {
        if (neo4j.isInt(value)) {
          obj[key] = value.toNumber()
        } else if (Array.isArray(value)) {
          obj[key] = value.map((v) => (neo4j.isInt(v) ? v.toNumber() : v))
        } else {
          obj[key] = value
        }
      }
      return obj
    })
  } catch (error) {
    console.error("Neo4j query failed:", error.code || "DatabaseError")
    throw error
  } finally {
    await session.close()
  }
}

// Helper function to format movie data from Neo4j
export function formatMovieFromNeo4j(record) {
  if (!record) return null

  return {
    id: record.id,
    title: record.title,
    releaseYear: record.releaseYear,
    imageUrl: record.imageUrl || "/placeholder.svg?height=400&width=300",
    synopsis: record.synopsis || "No synopsis available",
    genre: record.genre || [],
    rating: record.rating,
    voteAverage: record.voteAverage,
  }
}
