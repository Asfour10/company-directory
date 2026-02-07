# Company Directory

Enterprise-grade, multi-tenant SaaS platform for managing employee contact information and profiles.

## Features

- 🔐 SSO Authentication (Azure AD, Google Workspace, Okta)
- 👥 Multi-tenant architecture with complete data isolation
- 🔍 Fast full-text search with fuzzy matching
- 📊 Analytics and usage tracking
- 🎨 Customizable branding per tenant
- 📱 Responsive design for mobile and desktop
- 🔒 SOC 2 and GDPR compliant
- 📝 Comprehensive audit logging

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL with Prisma ORM
- Redis for caching
- AWS S3 for file storage

**Frontend:**
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- TanStack Query for data fetching

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Docker services (PostgreSQL and Redis):
   ```bash
   docker compose up -d
   ```
   
   **Note:** Use `docker-compose` (with hyphen) for older Docker versions.

4. Set up environment variables:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

5. Run database migrations:
   ```bash
   cd backend
   npm run prisma:migrate
   ```

6. Start development servers:
   ```bash
   npm run dev
   ```

The backend will run on http://localhost:3000
The frontend will run on http://localhost:5173

## Project Structure

```
company-directory/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── index.ts     # Entry point
│   │   ├── services/    # Business logic
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Express middleware
│   │   └── utils/       # Utilities
│   └── prisma/          # Database schema
├── frontend/            # React application
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       ├── hooks/       # Custom hooks
│       └── utils/       # Utilities
└── docker-compose.yml   # Local development services
```

## Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both applications for production
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## License

Proprietary
