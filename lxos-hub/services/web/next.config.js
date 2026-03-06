/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Security headers at the Next.js level (dev mode doesn't have nginx)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // Allow images from Google (avatars) and localhost API (uploads)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  // Silence annoying "missing display name" warnings from inline components
  reactStrictMode: true,
};

module.exports = nextConfig;
