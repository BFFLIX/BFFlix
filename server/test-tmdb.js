require('dotenv').config();
const axios = require('axios');

const testTMDB = async () => {
  try {
    const response = await axios.get(`${process.env.TMDB_BASE_URL}/movie/popular`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        language: 'en-US',
        page: 1
      }
    });
    
    console.log('✅ TMDB Connection Successful!');
    console.log('Sample movie:', response.data.results[0].title);
    console.log('Total results:', response.data.results.length);
  } catch (error) {
    console.error('❌ TMDB Connection Failed:', error.response?.data || error.message);
  }
};

testTMDB();