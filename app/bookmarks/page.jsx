"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { MovieGrid } from "@/components/movie-grid"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

const FETCH_TIMEOUT_MS = 10000

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([])
  const [bookmarkedIds, setBookmarkedIds] = useState([])
  const [userRatings, setUserRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      try {
        const [bookmarksRes, ratingsRes] = await Promise.all([
          fetchWithTimeout("/api/bookmarks").catch(() => null),
          fetchWithTimeout("/api/ratings").catch(() => null),
        ])
        if (bookmarksRes?.ok) {
          const data = await bookmarksRes.json()
          setBookmarks(data.bookmarks || [])
          setBookmarkedIds(data.bookmarkedIds || [])
        }
        if (ratingsRes?.ok) {
          const data = await ratingsRes.json()
          setUserRatings(data.ratings || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleRatingChange = async (movieId, rating) => {
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, rating }),
      })
      if (!response.ok) throw new Error("Failed to save rating")
      const newRatings = [...userRatings]
      const idx = newRatings.findIndex((r) => r.movieId === movieId)
      if (idx >= 0) newRatings[idx].rating = rating
      else newRatings.push({ movieId, rating })
      setUserRatings(newRatings)
      toast({ title: "Rating Saved", description: "Your rating has been saved." })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save rating.",
        variant: "destructive",
      })
    }
  }

  const handleBookmarkToggle = async (movieId) => {
    try {
      const isBookmarked = bookmarkedIds.includes(movieId)
      const method = isBookmarked ? "DELETE" : "POST"
      const response = await fetch("/api/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId }),
      })
      if (response.status === 401) {
        toast({
          title: "Sign in to bookmark",
          description: "Please sign in to save bookmarks.",
          variant: "destructive",
        })
        return
      }
      if (!response.ok) throw new Error("Failed to update bookmark")
      if (isBookmarked) {
        setBookmarkedIds((prev) => prev.filter((id) => id !== movieId))
        setBookmarks((prev) => prev.filter((m) => m.id !== movieId))
        toast({ title: "Bookmark removed" })
      } else {
        setBookmarkedIds((prev) => [...prev, movieId])
        toast({ title: "Bookmarked" })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update bookmark.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-center items-center h-72">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bookmarked Movies</h1>
          <p className="text-muted-foreground mt-1">Your saved list to watch later.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
      {bookmarks.length > 0 ? (
        <MovieGrid
          movies={bookmarks}
          userRatings={userRatings}
          onRatingChange={handleRatingChange}
          bookmarkedIds={bookmarkedIds}
          onBookmarkToggle={handleBookmarkToggle}
        />
      ) : (
        <div className="text-center py-16 rounded-2xl bg-muted/50 border border-border/60">
          <p className="text-muted-foreground">
            No bookmarks yet. Use the bookmark icon on any movie to save it here.
          </p>
        </div>
      )}
    </div>
  )
}
