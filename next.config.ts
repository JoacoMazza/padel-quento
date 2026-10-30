import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Minifying the server renames the entity classes, and TypeORM looks entities up by class
    // name ("Admin", getRepository("Account")): in production it can't find them (issue #85).
    turbopackMinify: { server: false, client: true },
  },
  serverExternalPackages: ["typeorm", "pg", "bcrypt"],
};

export default nextConfig;
