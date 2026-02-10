// Script to create admin user in Render PostgreSQL database
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory';

async function setupAdminUser() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Create tenant
    console.log('\nCreating tenant...');
    const tenantResult = await client.query(`
      INSERT INTO tenants (id, name, subdomain, subscription_tier, user_limit, created_at, updated_at)
      SELECT gen_random_uuid(), 'My Company', 'mycompany', 'free', 10, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1)
      RETURNING id, name;
    `);
    
    if (tenantResult.rowCount > 0) {
      console.log('✓ Tenant created:', tenantResult.rows[0]);
    } else {
      console.log('✓ Tenant already exists');
    }

    // Create admin user
    console.log('\nCreating admin user...');
    const userResult = await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, tenant_id, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'admin@company.com',
        '$2b$10$14F.J9r1vEWXJUIIO8wDhO13BjzDIYj4HTadj9qWMJLXmEBqk/z7O',
        'Admin',
        'User',
        'super_admin',
        (SELECT id FROM tenants LIMIT 1),
        NOW(),
        NOW()
      )
      RETURNING id, email, first_name, last_name, role;
    `);
    
    console.log('✓ Admin user created:', userResult.rows[0]);

    // Verify
    console.log('\nVerifying setup...');
    const verifyResult = await client.query(`
      SELECT 
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        t.name as tenant_name
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id;
    `);
    
    console.log('\n=== Database Setup Complete ===');
    console.log('Users in database:', verifyResult.rows);
    console.log('\n✓ You can now login at: https://company-directory-frontend.onrender.com');
    console.log('  Email: admin@company.com');
    console.log('  Password: admin123');
    console.log('================================\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupAdminUser();
