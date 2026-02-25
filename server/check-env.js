require('dotenv').config();
console.log('DATABASE_URL status:', process.env.DATABASE_URL ? 'Loaded' : 'Missing');
if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL value:', process.env.DATABASE_URL);
}
