import { auth } from "@/auth"

export async function getCurrentUser() {
  try {
    const session = await auth()
    return session?.user?.id ? session.user : null
  } catch {
    return null
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  return user
}
