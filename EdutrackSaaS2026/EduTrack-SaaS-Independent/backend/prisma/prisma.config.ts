// backend/prisma/prisma.config.ts
export default {
  datasource: {
    db: {
      provider: "postgresql",
      url: process.env.DATABASE_URL,
    },
  },
};
