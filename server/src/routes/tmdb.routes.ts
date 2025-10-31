import { Router } from "express";
import tmdb from "../Services/tmdb.service";

/**
 * Routes for interacting with The Movie Database (TMDB) API.
 * These endpoints proxy requests to the TMDBService and return the raw responses.
 * No authentication is required to access these routes.
 *
 * Available routes:
 *   GET /search?query=<string>&page=<number>
 *   GET /movie/:id
 *   GET /tv/:id
 *   GET /movie/:id/providers
 *   GET /tv/:id/providers
 *   GET /providers
 *   GET /discover/movie
 *   GET /discover/tv
 */
const router = Router();

// Multi-search across movies, TV shows and people
router.get("/search", async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
  if (!query) {
    return res.status(400).json({ error: "query parameter is required" });
  }
  try {
    const result = await tmdb.searchMulti(query, page);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB search error:", error?.message || error);
    return res.status(500).json({ error: "Failed to search TMDB" });
  }
});

// Get detailed information about a movie
router.get("/movie/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tmdb.getMovieDetails(id);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB movie detail error:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch movie details" });
  }
});

// Get detailed information about a TV show
router.get("/tv/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tmdb.getTVDetails(id);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB TV detail error:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch TV details" });
  }
});

// Get watch providers for a movie (for example streaming platforms)
router.get("/movie/:id/providers", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tmdb.getMovieProviders(id);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB movie providers error:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch movie providers" });
  }
});

// Get watch providers for a TV show
router.get("/tv/:id/providers", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tmdb.getTVProviders(id);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB TV providers error:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch TV providers" });
  }
});

// Get a list of all available providers from TMDB
router.get("/providers", async (_req, res) => {
  try {
    const result = await tmdb.getAvailableProviders();
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB providers list error:", error?.message || error);
    return res.status(500).json({ error: "Failed to fetch providers list" });
  }
});

// Discover movies based on query parameters
router.get("/discover/movie", async (req, res) => {
  try {
    // Spread the query parameters directly; TMDBService will handle defaults
    const options: any = { ...req.query };
    const result = await tmdb.discoverMovies(options);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB discover movies error:", error?.message || error);
    return res.status(500).json({ error: "Failed to discover movies" });
  }
});

// Discover TV shows based on query parameters
router.get("/discover/tv", async (req, res) => {
  try {
    const options: any = { ...req.query };
    const result = await tmdb.discoverTV(options);
    return res.json(result);
  } catch (error: any) {
    console.error("TMDB discover TV error:", error?.message || error);
    return res.status(500).json({ error: "Failed to discover TV shows" });
  }
});

export default router;
