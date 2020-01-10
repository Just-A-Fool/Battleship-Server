module.exports = {
  NODE_ENV : process.env.NODE_ENV || 'development',
  PORT : process.env.PORT || 8000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'this_is_super_secret',
  // JWT_EXPIRY: process.env.JWT_EXPIRY || '', // Possibly implement later
};