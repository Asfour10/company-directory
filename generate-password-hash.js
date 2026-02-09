// Generate bcrypt password hash for admin user
// Usage: node generate-password-hash.js YourPassword123

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'password123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('\n=== Password Hash Generated ===');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nCopy this hash and replace it in setup-admin-user.sql');
  console.log('================================\n');
});
