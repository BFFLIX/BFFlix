import axios, { AxiosInstance } from 'axios';

interface TMDBResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}

interface WatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

interface MovieProviders {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

interface DiscoverOptions {
  page?: number;
  sort_by?: string;
  with_watch_providers?: string;
  watch_region?: string;
  with_genres?: string;
  language?: string;
}

class TMDBService {
  private apiKey: string;
  private baseURL: string;
  private imageBaseURL: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '';
    this.baseURL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
    this.imageBaseURL = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      params: {
        api_key: this.apiKey,
      },
    });
  }

  async getMovieProviders(movieId: string | number): Promise<MovieProviders | null> {
    try {
      const response = await this.client.get(`/movie/${movieId}/watch/providers`);
      return response.data.results.US || null;
    } catch (error: any) {
      console.error('Error fetching movie providers:', error.message);
      throw error;
    }
  }

  async getTVProviders(tvId: string | number): Promise<MovieProviders | null> {
    try {
      const response = await this.client.get(`/tv/${tvId}/watch/providers`);
      return response.data.results.US || null;
    } catch (error: any) {
      console.error('Error fetching TV providers:', error.message);
      throw error;
    }
  }

  async discoverMovies(options: DiscoverOptions = {}): Promise<TMDBResponse<any>> {
    try {
      const response = await this.client.get('/discover/movie', {
        params: {
          ...options,
          watch_region: 'US',
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error discovering movies:', error.message);
      throw error;
    }
  }

  async discoverTV(options: DiscoverOptions = {}): Promise<TMDBResponse<any>> {
    try {
      const response = await this.client.get('/discover/tv', {
        params: {
          ...options,
          watch_region: 'US',
          language: 'en-US',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error discovering TV shows:', error.message);
      throw error;
    }
  }

  async getMovieDetails(movieId: string | number): Promise<any> {
    try {
      const response = await this.client.get(`/movie/${movieId}`, {
        params: {
          append_to_response: 'credits,videos,watch/providers',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching movie details:', error.message);
      throw error;
    }
  }

  async getTVDetails(tvId: string | number): Promise<any> {
    try {
      const response = await this.client.get(`/tv/${tvId}`, {
        params: {
          append_to_response: 'credits,videos,watch/providers',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching TV details:', error.message);
      throw error;
    }
  }

  async searchMulti(query: string, page: number = 1): Promise<TMDBResponse<any>> {
    try {
      const response = await this.client.get('/search/multi', {
        params: {
          query,
          page,
          include_adult: false,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error searching:', error.message);
      throw error;
    }
  }

  getPosterURL(path: string | null, size: string = 'w500'): string | null {
    if (!path) return null;
    return `${this.imageBaseURL}/${size}${path}`;
  }

  async getAvailableProviders(): Promise<WatchProvider[]> {
    try {
      const response = await this.client.get('/watch/providers/movie', {
        params: {
          watch_region: 'US',
        },
      });
      return response.data.results;
    } catch (error: any) {
      console.error('Error fetching providers:', error.message);
      throw error;
    }
  }
}

export default new TMDBService();