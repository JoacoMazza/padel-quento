import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["typeorm", "pg", "bcrypt"],
};

export default nextConfig;
