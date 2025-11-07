import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, "../../"),
  /*Uncomment it on production environment*/
  //devIndicators: false,
};

export default nextConfig;
