import { createUser } from '@/auth'
import { runQuery, isNeo4jConfigured } from '@/lib/neo4j'
import { isValidEmail, checkEmailDomain } from '@/lib/email-validation.cjs'

export async function POST(request) {
  try {
    if (!isNeo4jConfigured()) {
      return Response.json(
        { error: 'Database not set up. Please add NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD to .env.local and run setup-db.' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = body.password

    // Validation
    if (!isValidEmail(email)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (
        typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 || !name || name.length > 100) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const domainStatus = await checkEmailDomain(email)
    if (domainStatus === 'invalid') {
      return Response.json({ error: 'This email domain cannot receive email. Check for a typo.' }, { status: 400 })
    }
    if (domainStatus === 'unavailable') {
      return Response.json({ error: 'Unable to check the email domain right now. Please try again.' }, { status: 503 })
    }

    // Check if user already exists
    const existingUser = await runQuery(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email }
    )

    if (existingUser.length > 0) {
      return Response.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create user
    const user = await createUser(email, password, name)

    return Response.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (error) {
    console.error('Registration error:', error.code || 'DatabaseError')
    if (error.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
      return Response.json({ error: 'User already exists' }, { status: 409 })
    }
    const msg = error?.message || ''
    let userMessage = 'Failed to register user.'
    if (/timeout|ETIMEDOUT|Connection refused/i.test(msg)) {
      userMessage = 'Cannot reach Neo4j (timeout). Check NEO4J_URI in .env.local and that your Neo4j Aura instance is running (not paused).'
    } else if (/authentication|Authorization failed|Unauthorized/i.test(msg)) {
      userMessage = 'Neo4j login failed. Check NEO4J_USER and NEO4J_PASSWORD in .env.local.'
    } else if (/ServiceUnavailable|no routing servers/i.test(msg)) {
      userMessage = 'Neo4j is unavailable. If using Aura Free, open https://console.neo4j.io and resume your database if it is paused.'
    } else {
      userMessage = 'Database error. Ensure Neo4j is running and you ran: npm run setup-db. If using Aura, resume the instance in the console.'
    }
    return Response.json(
      { error: userMessage },
      { status: 500 }
    )
  }
}
