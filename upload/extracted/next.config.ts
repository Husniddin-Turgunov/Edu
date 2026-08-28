import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared hosting (Passenger) needs a self-contained server bundle.
  output: "standalone",
  // Prod uses @libsql/client/web (HTTP). Local SQLite uses native driver
  // only when AKELA_USE_LOCAL_DB=1.
};

export default nextConfig;
