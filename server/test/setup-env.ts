/**
 * E2e testlar uchun muhit o'zgaruvchilari — har qanday modul (AppModule /
 * ConfigModule validatsiyasi) yuklanishidan OLDIN o'rnatiladi (jest setupFiles).
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db?schema=public';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_0123456789';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789';
