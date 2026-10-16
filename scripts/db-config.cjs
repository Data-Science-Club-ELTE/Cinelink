const path = require('node:path')
const neo4j = require('neo4j-driver')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
function openDriver() {
  const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env
  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD || NEO4J_PASSWORD.startsWith('replace-')) {
    throw new Error('Set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD in .env.local')
  }
  return neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD.trim()), {
    connectionTimeout: 10000, connectionAcquisitionTimeout: 10000, maxConnectionPoolSize: 5,
  })
}
module.exports = { openDriver }
