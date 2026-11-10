/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/inventario/components/*/lotes/*/etiqueta": ["./public/templates/Formato_Control de inspección.lbx"],
    "/api/inventario/vales/*/docx": ["./public/templates/vale-material.docx"],
  },
  experimental: {
    
  },
};

export default nextConfig;