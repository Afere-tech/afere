import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Usando exatamente a variável que você configurou na Vercel
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Se a variável não estiver definida, não criamos o rewrite para não quebrar o site
    if (!apiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;