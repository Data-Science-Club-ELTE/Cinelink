export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user?.id
      const isOnProtected = nextUrl.pathname.startsWith('/profile') ||
                           nextUrl.pathname.startsWith('/bookmarks')

      return !isOnProtected || isLoggedIn
    },
  },
  providers: [], // Will be added in auth.js
}
