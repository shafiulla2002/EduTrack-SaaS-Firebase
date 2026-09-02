# EduTrack SaaS Independent Platform

This is a completely independent, multi-tenant SaaS version of the EduTrack School & College Management Application. It is built to operate entirely outside the Salesforce ecosystem.

## Tech Stack
* **Frontend**: Next.js, TypeScript, Tailwind CSS, Framer Motion
* **Backend**: NestJS, TypeScript, REST APIs
* **Database**: Firebase / Cloud SQL PostgreSQL via Prisma ORM
* **Authentication**: JWT Auth with Role-Based Access Control (RBAC)
* **File Storage**: AWS S3 integration

## Project Structure
```
EduTrack-SaaS-Independent/
├── backend/            # NestJS backend API
│   ├── prisma/         # Prisma schema and migrations
│   └── src/            # NestJS modules and code
├── frontend/           # Next.js frontend application
│   └── src/            # Pages, components, and hooks
└── README.md           # This document
```

## Getting Started

### Database Setup
1. Define your connection string in `backend/.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5402/edutrack_saas?schema=public"
   ```
2. Run Prisma migrations:
   ```bash
   cd backend
   npx prisma migrate dev --name init
   ```

### Running Locally

#### Run Backend
```bash
cd backend
npm install
npm run start:dev
```

#### Run Frontend
```bash
cd frontend
npm install
npm run dev
```
