import type { NextConfig } from "next";

// When building for GitHub Pages (GITHUB_PAGES=true), export a fully static site
// served from https://<user>.github.io/snpcomp/
const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/snpcomp" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
