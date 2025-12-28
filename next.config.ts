import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Enable experimental features for WASM support
  experimental: {
    esmExternals: 'loose',
  },
  
  // Webpack configuration for FFmpeg.wasm support
  webpack: (config, { dev, isServer }) => {
    // Add support for WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Resolve FFmpeg modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },

  // Headers for cross-origin isolation (required for SharedArrayBuffer)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },

  // Output configuration
  output: 'standalone',
  
  // Enable static optimization
  trailingSlash: false,
  
  // Image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;