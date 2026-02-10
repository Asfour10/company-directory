// Script to run database migrations on Render PostgreSQL
const { execSync } = require('child_process');

const DATABASE_URL = 'postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory';

console.log('Setting up database schema...\n');

try {
  // Set the DATABASE_URL environment variable and run migrations
  process.env.DATABASE_URL = DATABASE_URL;
  
  console.log('Running Prisma migrations...');
  execSync('cd backend && npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL }
  });
  
  console.log('\n✓ Database schema created successfully!');
  console.log('\nNow run: node setup-admin-user.js');
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
