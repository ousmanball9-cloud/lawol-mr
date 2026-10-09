/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
  experimental: { optimizePackageImports: ['lucide-react', 'flowbite-react'] }
}
export default nextConfig