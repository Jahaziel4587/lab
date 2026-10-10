/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/inventario/vales/*/docx": ["./public/templates/vale-material.docx"],
  },
  experimental: {
    
  },
};

export default nextConfig;