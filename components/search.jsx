"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const DEBOUNCE_MS = 300
const SUGGESTIONS_LIMIT = 10

export function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/movies?search=${encodeURIComponent(trimmed)}&limit=${SUGGESTIONS_LIMIT}`
      )
      const data = await res.json().catch(() => ({}))
      setSuggestions(data.movies || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const t = setTimeout(() => {
      fetchSuggestions(query)
      setOpen(true)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setOpen(false)
    onSearch(query)
  }

  const pickSuggestion = (movie) => {
    setQuery(movie.title)
    setOpen(false)
    onSearch(movie.title)
  }

  return (
    <form
      ref={wrapperRef}
      onSubmit={handleSubmit}
      className="relative w-full"
    >
      <div className="relative">
        <Input
          type="text"
          placeholder="Search for movies..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="pr-11 h-11 rounded-xl border-border/80 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </div>

      {open && (query.trim() !== "" || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-2 bg-popover border border-border/80 rounded-xl shadow-lg max-h-64 overflow-auto">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Searching…</div>
          ) : suggestions.length > 0 ? (
            <ul className="py-1.5" role="listbox">
              {suggestions.map((movie) => (
                <li key={movie.id} role="option">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/80 focus:bg-muted/80 focus:outline-none rounded-lg mx-1 transition-colors"
                    onClick={() => pickSuggestion(movie)}
                  >
                    {movie.title}
                    {movie.releaseYear ? (
                      <span className="text-muted-foreground ml-2">({movie.releaseYear})</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No movies match “{query.trim()}”</div>
          )}
        </div>
      )}
    </form>
  )
}
