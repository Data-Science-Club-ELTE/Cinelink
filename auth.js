import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { runQuery, isNeo4jConfigured } from './lib/neo4j'
import { randomUUID } from 'node:crypto'

async function getUser(email) {
  try {
    if (!isNeo4jConfigured()) {
      console.error('Neo4j is not configured. Cannot look up user.')
      return null
    }
    const result = await runQuery(
      `MATCH (u:User {email: $email}) RETURN u.id as id, u.email as email, u.password as password, u.name as name`,
      { email }
    )

    if (!result || result.length === 0) {
      return null
    }

    const user = result[0]
    return user
  } catch (error) {
    console.error('User lookup failed:', error.code || 'DatabaseError')
    return null
  }
}

async function createUser(email, password, name) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = `user-${randomUUID()}`


    const result = await runQuery(
      `CREATE (u:User {
        id: $userId,
        email: $email,
        password: $password,
        name: $name,
        createdAt: timestamp()
      })
      RETURN u.id as id, u.email as email, u.name as name`,
      {
        userId,
        email,
        password: hashedPassword,
        name
      }
    )

    return result[0] || { id: userId, email, name }
  } catch (error) {
    console.error('User creation failed:', error.code || 'DatabaseError')
    throw error
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {

        if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string') {
          return null
        }

        const user = await getUser(credentials.email.trim().toLowerCase())

        if (!user) {
          return null
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordsMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
})

export { createUser }
