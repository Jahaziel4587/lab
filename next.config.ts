/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  // Asegúrate de que esto está habilitado (aunque ya no es obligatorio, a veces ayuda)
  appDir: true,
};

export default nextConfig;