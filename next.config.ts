import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cfqrhyxdocuwltpbradj.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/test/**",
      },
    ],
  },
};

export default nextConfig;