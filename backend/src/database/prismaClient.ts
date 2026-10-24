import { PrismaClient } from "@prisma/client";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log the database URL (without password for security)
const dbUrl = process.env.DATABASE_URL;
console.log('Database URL:', dbUrl ? dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'Not found');

// Create Prisma client with logging
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Test database connection
async function testConnection() {
  try {
    // Run a simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('✅ Database connection successful', result);
    
    // Get count of files in database for debugging
    const fileCount = await prisma.file.count();
    console.log(`Database contains ${fileCount} files`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Run the test immediately
testConnection()
  .catch(e => {
    console.error('Unexpected error during database connection test:', e);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('Disconnected from database');
});

