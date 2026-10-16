/**
 * Initialize Neo4j database: create constraints and indexes for the movie app schema.
 * Run from project root: node scripts/setup-neo4j.js
 * Requires .env.local with NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
 */

const path = require('path')
const neo4j = require('neo4j-driver')

// Load .env.local from project root
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const URI = process.env.NEO4J_URI
const USER = process.env.NEO4J_USER
const PASSWORD = process.env.NEO4J_PASSWORD

if (!URI || !USER || !PASSWORD) {
  console.error('Missing Neo4j config. Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env.local')
  process.exit(1)
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
  connectionTimeout: 10000,
  maxConnectionPoolSize: 5,
})

async function run(session, query, params = {}) {
  const result = await session.run(query, params)
  return result.records.map(r => {
    const obj = {}
    for (const [key, value] of Object.entries(r.toObject())) {
      obj[key] = neo4j.isInt(value) ? value.toNumber() : value
    }
    return obj
  })
}

async function main() {
  const session = driver.session()
  try {
    console.log('Connecting to Neo4j...')
    await session.run('RETURN 1')
    console.log('Connected.\nCreating constraints and indexes...')

    const constraints = [
      { modern: 'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE', legacy: 'CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE' },
      { modern: 'CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE', legacy: 'CREATE CONSTRAINT ON (u:User) ASSERT u.email IS UNIQUE' },
      { modern: 'CREATE CONSTRAINT movie_id_unique IF NOT EXISTS FOR (m:Movie) REQUIRE m.id IS UNIQUE', legacy: 'CREATE CONSTRAINT ON (m:Movie) ASSERT m.id IS UNIQUE' },
      { modern: 'CREATE CONSTRAINT genre_name_unique IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE', legacy: 'CREATE CONSTRAINT ON (g:Genre) ASSERT g.name IS UNIQUE' },
    ]

    for (const { modern, legacy } of constraints) {
      const label = modern.split('FOR')[1]?.trim()?.split(')')[0] || ''
      try {
        await session.run(modern)
        console.log('  OK:', label)
      } catch (e) {
        const alreadyExists = /EquivalentSchemaRuleAlreadyExists|already exists|Constraint already exists/i.test(e.message || '')
        if (alreadyExists) {
          console.log('  (already exists):', label)
        } else {
          try {
            await session.run(legacy)
            console.log('  OK (legacy):', label)
          } catch (e2) {
            if (/already exists|EquivalentSchemaRuleAlreadyExists/i.test(e2.message || '')) {
              console.log('  (already exists):', label)
            } else {
              throw e2
            }
          }
        }
      }
    }

    console.log('\nSetup complete. You can run: npm run import-movies')
  } catch (error) {
    console.error('Setup failed:', error.code || error.name)
    process.exitCode = 1
  } finally {
    await session.close()
    await driver.close()
  }
}

main()
