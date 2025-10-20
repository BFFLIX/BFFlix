const axios = require('axios');

class TMDBService {
  constructor() {
    this.apiKey = process.env.TMDB_API_KEY;
    this.baseURL = process.env.TMDB_BASE_URL;
    this.imageBaseURL = process.env.TMDB_IMAGE_BASE_URL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      params: {
        api_key: this.apiKey,
      },
    });
  }

  // Get streaming providers for a movie
  async getMovieProviders(movieId) {
    try {
      const response = await this.client.get(`/movie/${movieId}/watch/providers`);
      return response.data.results.US || null;
    } catch (error) {
      console.error('Error fetching movie providers:', error.message);
      throw error;
    }
  }

  // Get streaming providers for a TV show
  async getTVProviders(tvId) {
    try {
      const response = await this.client.get(`/tv/${tvId}/watch/providers`);
      return response.data.results.US || null;
    } catch (error) {
      console.error('Error fetching TV providers:', error.message);
      throw error;
    }
  }

  // Discover movies
  async discoverMovies(options = {}) {
    try {
      const response = await this.client.get('/discover/movie', {
        params: {
          ...options,
          watch_region: 'US',
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error discovering movies:', error.message);
      throw error;
    }
  }

  // Discover TV shows
  async discoverTV(options = {}) {
    try {
      const response = await this.client.get('/discover/tv', {
        params: {
          ...options,
          watch_region: 'US',
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error discovering TV shows:', error.message);
      throw error;
    }
  }

  // Get movie details
  async getMovieDetails(movieId) {
    try {
      const response = await this.client.get(`/movie/${movieId}`, {
        params: {
          append_to_response: 'credits,videos,watch/providers',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching movie details:', error.message);
      throw error;
    }
  }

  // Get TV show details
  async getTVDetails(tvId) {
    try {
      const response = await this.client.get(`/tv/${tvId}`, {
        params: {
          append_to_response: 'credits,videos,watch/providers',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching TV details:', error.message);
      throw error;
    }
  }

  // Search multi (movies and TV)
  async searchMulti(query, page = 1) {
    try {
      const response = await this.client.get('/search/multi', {
        params: {
          query,
          page,
          include_adult: false,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching:', error.message);
      throw error;
    }
  }

  // Get poster URL
  getPosterURL(path, size = 'w500') {
    if (!path) return null;
    return `${this.imageBaseURL}/${size}${path}`;
  }

  // Get available streaming providers (for your database)
  async getAvailableProviders() {
    try {
      const response = await this.client.get('/watch/providers/movie', {
        params: {
          watch_region: 'US',
        },
      });
      return response.data.results;
    } catch (error) {
      console.error('Error fetching providers:', error.message);
      throw error;
    }
  }
}