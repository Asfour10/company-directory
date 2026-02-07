# Setup Guide

## Quick Start

Follow these steps to get the Company Directory application running locally:

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for the root project and both workspaces (backend and frontend).

### 2. Start Docker Services

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

**Note:** If you get a "command not found" error, try `docker-compose up -d` (with hyphen) for older Docker versions.

Verify services are running:
```bash
docker compose ps
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and update the following (minimum required):
- `JWT_SECRET` - Generate a secure random string
- `ENCRYPTION_KEY` - Generate a 32-character key
- Other values can use defaults for local development

### 4. Set Up Database

Run Prisma migrations to create database tables:

```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
cd ..
```

### 5. Start Development Servers

Start both backend and frontend in development mode:

```bash
npm run dev
```

This will start:
- Backend API on http://localhost:3000
- Frontend on http://localhost:5173

### 6. Verify Installation

Check the backend health endpoint:
```bash
curl http://localhost:3000/health
```

Open the frontend in your browser:
```
http://localhost:5173
```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch --workspace=backend
```

### Linting and Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
npm run prisma:studio --workspace=backend

# Create a new migration
npm run prisma:migrate --workspace=backend

# Reset database (WARNING: deletes all data)
cd backend && npx prisma migrate reset
```

### Docker Commands

```bash
# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Remove volumes (WARNING: deletes all data)
docker compose down -v
```

**Note:** Use `docker-compose` (with hyphen) if you have an older Docker version.

## Troubleshooting

### Port Already in Use

If ports 3000, 5173, 5432, or 6379 are already in use:

1. Stop the conflicting service
2. Or modify the ports in `docker-compose.yml` and update `.env` accordingly

### Database Connection Issues

1. Ensure Docker services are running: `docker compose ps`
2. Check DATABASE_URL in `backend/.env`
3. Try restarting Docker services: `docker compose restart`

### Module Not Found Errors

1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules backend/node_modules frontend/node_modules
   npm install
   ```

2. Regenerate Prisma client:
   ```bash
   cd backend && npm run prisma:generate
   ```

## Next Steps

After completing setup, you can:

1. Review the requirements document in `.kiro/specs/company-directory/requirements.md`
2. Check the design document in `.kiro/specs/company-directory/design.md`
3. Start implementing tasks from `.kiro/specs/company-directory/tasks.md`

The next task is to set up the database schema with Prisma (Task 2).
