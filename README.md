# Notez

A self-hosted, web-based note-taking application with AI-powered features. Combines the best of Notepad++ and Obsidian in a modern web interface.

## Features (MVP)

- **User Management** - Admin-controlled user accounts with secure authentication
- **Note Management** - Create, edit, and organize notes with auto-save
- **Folders & Tags** - Organize notes with folders and tags
- **Full-Text Search** - Fast search across all notes
- **Monaco Editor** - Professional code editing experience with syntax highlighting
- **AI Features** - Summarize notes, suggest titles and tags (Anthropic, OpenAI, Google Gemini)
- **Dark Mode** - Modern, responsive UI with dark/light themes

## Tech Stack

- **Backend:** Node.js 20, Fastify, TypeScript, Prisma
- **Database:** PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite, Monaco Editor
- **Deployment:** Docker, GitHub Actions → ghcr.io

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Git

## Quick Start (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/notez.git
cd notez
```

### 2. Set up environment variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your values (defaults work for local dev)
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 3. Start with Docker Compose

```bash
# From the root directory
docker compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 3000
- Frontend on port 5173

### 4. Run database migrations

```bash
# The backend container automatically runs migrations on startup
# To run manually:
docker compose exec backend npx prisma migrate deploy
```

### 5. Access the application

Open your browser to [http://localhost:5173](http://localhost:5173)

On first visit, you'll be prompted to create an admin account.

## Local Development (Without Docker)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start PostgreSQL (or use Docker)
docker run -d \
  --name notez-postgres \
  -e POSTGRES_USER=notez \
  -e POSTGRES_PASSWORD=notez \
  -e POSTGRES_DB=notez \
  -p 5432:5432 \
  postgres:16-alpine

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start dev server (with hot reload)
npm run dev
```

Backend will be available at [http://localhost:3000](http://localhost:3000)

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start dev server (with hot reload)
npm run dev
```

Frontend will be available at [http://localhost:5173](http://localhost:5173)

## Production Deployment

### 1. Configure GitHub Container Registry

The project uses GitHub Actions to build and push Docker images to ghcr.io.

**Set up GitHub secrets:**
- `GHCR_TOKEN` - GitHub Personal Access Token with `write:packages` permission

### 2. Update compose.prod.yml

Edit the image names:
```yaml
backend:
  image: ghcr.io/YOUR_USERNAME/notez-backend:latest

frontend:
  image: ghcr.io/YOUR_USERNAME/notez-frontend:latest
```

### 3. Create production environment file

```bash
# Create .env.prod
cp backend/.env.example .env.prod
```

Edit `.env.prod` with secure values:
```bash
POSTGRES_PASSWORD=<strong-random-password>
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>
ENCRYPTION_KEY=<random-32-char-string>
CORS_ORIGIN=https://notez.curgghoth.com
```

### 4. Deploy to your server

```bash
# On your server
git clone https://github.com/yourusername/notez.git
cd notez

# Copy your production env file
cp .env.prod .env

# Start services
docker compose -f compose.prod.yml up -d
```

### 5. Configure Cloudflare Tunnel

Set up a Cloudflare Tunnel pointing to:
- `http://notez-frontend:80` for the web interface
- Optionally `http://notez-backend:3000` for direct API access

## CI/CD Pipeline

The project uses GitHub Actions for automated builds and deployments.

**Workflow:** `.github/workflows/deploy.yml`

**On push to `main`:**
1. Run tests
2. Build Docker images
3. Push to ghcr.io
4. (Optional) Trigger Portainer webhook

## Project Structure

```
notez/
├── backend/              # Fastify API server
│   ├── src/
│   │   ├── index.ts     # Entry point
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── utils/       # Utilities
│   │   └── types/       # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/            # React web app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   ├── stores/      # Zustand stores
│   │   ├── lib/         # API client, utilities
│   │   └── main.tsx     # Entry point
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── package.json
├── docker/              # Additional Docker configs
├── docs/                # Documentation
│   ├── requirements.md
│   └── mvp-specification.md
├── .github/
│   └── workflows/       # GitHub Actions
├── compose.yml       # Development
├── compose.prod.yml  # Production
└── README.md
```

## API Documentation

### Health Check
```
GET /health
```

Returns server and database status.

### Authentication
```
POST /api/auth/setup     # Initial admin setup
POST /api/auth/login     # User login
POST /api/auth/refresh   # Refresh access token
POST /api/auth/logout    # Logout
```

### Notes (Authenticated)
```
GET    /api/notes        # List notes
GET    /api/notes/:id    # Get note
POST   /api/notes        # Create note
PATCH  /api/notes/:id    # Update note
DELETE /api/notes/:id    # Delete note
```

Full API documentation coming soon.

## Database Schema

See [backend/prisma/schema.prisma](backend/prisma/schema.prisma) for the complete schema.

**Main tables:**
- `users` - User accounts
- `sessions` - Authentication sessions
- `notes` - Note content and metadata
- `folders` - Organization folders
- `tags` - Note tags
- `note_tags` - Note-tag relationships
- `system_settings` - Application configuration

## Configuration

### Environment Variables

**Backend:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - JWT access token secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `ENCRYPTION_KEY` - Encryption key for sensitive data
- `CORS_ORIGIN` - Allowed CORS origin

**Frontend:**
- `VITE_API_URL` - Backend API URL

### AI Provider Configuration

AI providers are configured through the admin panel after deployment. You can also set them via environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

## Development

### Running Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Database Management

```bash
# Create a new migration
cd backend
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Code Formatting

```bash
# Lint
npm run lint

# Format (if configured)
npm run format
```

## Troubleshooting

### Database connection issues

Check that PostgreSQL is running:
```bash
docker compose ps postgres
```

View logs:
```bash
docker compose logs postgres
```

### Backend won't start

Check logs:
```bash
docker compose logs backend
```

Ensure migrations have run:
```bash
docker compose exec backend npx prisma migrate deploy
```

### Frontend build issues

Clear node_modules and reinstall:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Contributing

This is a personal project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - See LICENSE file for details

## Roadmap

See [docs/requirements.md](docs/requirements.md) for the full feature roadmap.

**Coming in Phase 2:**
- Note linking with [[syntax]]
- Graph visualization
- Version history
- Multi-tab editor
- Auto-indexing and semantic search

## Support

For issues and questions, please open a GitHub issue.

---

Built with ❤️ using Fastify, React, and Claude AI
