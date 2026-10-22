# Deploying EduTrack SaaS to Vercel

This guide provides step-by-step instructions for deploying both the NestJS backend and the Next.js frontend of the **EduTrack SaaS Independent** platform to **Vercel**. By deploying both components to Vercel, you avoid the 15-minute inactivity sleep/spin-down associated with Render's free tier.

---

## 1. Deploy the NestJS Backend (Serverless)

We have configured the NestJS backend to run as a Vercel Serverless Function by adapting the entry point in `backend/src/main.ts` and adding a `vercel.json` routing configuration.

### Steps to Deploy:
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import your GitHub repository: `shafiulla90/EduTrack-SaaS`.
4. On the **Configure Project** screen:
   - **Project Name**: `edutrack-saas-backend` (or a name of your choice).
   - **Framework Preset**: Choose **Other** (do *not* choose NestJS as it expects a persistent node server by default).
   - **Root Directory**: Click *Edit* and select the **`backend`** folder.
5. Expand **Build and Output Settings**:
   - **Build Command**: Keep standard defaults (it will run NestJS build or look at our `package.json`).
   - **Install Command**: Defaults to `npm install`.
6. Expand **Environment Variables** and add the following keys:
   - `DATABASE_URL`: `postgresql://postgres:School2026DB@school-management-db.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&connection_limit=2`
     > [!TIP]
     > Note the addition of `&connection_limit=2` to the end of the `DATABASE_URL`. Since serverless functions scale horizontally and terminate after execution, limiting the connection count per function prevents exhausting the database connections of your AWS RDS instance.
   - `JWT_SECRET`: `edutrack-super-secret-key-change-in-production-19823612` (or a random secure string).
   - `JWT_EXPIRATION`: `24h`
   - `JWT_REFRESH_SECRET`: `edutrack-super-refresh-secret-key-change-in-production-472619`
   - `JWT_REFRESH_EXPIRATION`: `7d`
   - `AWS_REGION`: `us-east-1`
   - `AWS_S3_BUCKET_NAME`: `edutrack-saas-media`
7. Click **Deploy**.

Vercel will build the backend, run `prisma generate` during the post-install hook, and deploy the application. Once finished, Vercel will provide a deployment URL (e.g., `https://edutrack-saas-backend.vercel.app`).

---

## 2. Deploy the Next.js Frontend

The Next.js frontend is fully compatible with Vercel and deploys out-of-the-box.

### Steps to Deploy:
1. Go back to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import your GitHub repository: `shafiulla90/EduTrack-SaaS`.
4. On the **Configure Project** screen:
   - **Project Name**: `edutrack-saas-frontend` (or a name of your choice).
   - **Framework Preset**: **Next.js** (detected automatically).
   - **Root Directory**: Click *Edit* and select the **`frontend`** folder.
5. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_API_URL`: Paste the Vercel backend deployment URL you obtained in Step 1 (e.g., `https://edutrack-saas-backend.vercel.app`).
     *Make sure there is no trailing slash `/` at the end of the URL.*
6. Click **Deploy**.

Vercel will build the Next.js project and deploy it. You will get a production URL for your school ERP frontend (e.g., `https://edutrack-saas-frontend.vercel.app`).

---

## 3. Serverless Best Practices for AWS RDS + Vercel

When running a database-driven NestJS server on serverless infrastructure, keep the following considerations in mind:

### Connection Pooling
Serverless functions are short-lived. Every time Vercel initializes a cold start, NestJS boots up and opens a connection to AWS RDS. If your traffic spikes, Vercel starts multiple instances, potentially exhausting your RDS database's connection limit.
* **Solution**: Keep `connection_limit=2` in your `DATABASE_URL` (as suggested in Step 1). For heavy production workloads, consider using an **AWS RDS Proxy** or a service like **Prisma Accelerate** to pool database connections.

### Cold Starts
The first request to the backend after a period of inactivity may take 2-4 seconds to load while NestJS bootstraps in the background. Subsequent requests will be extremely fast (warm execution).
