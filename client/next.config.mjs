/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend (NestJS) serverga server-to-server (BFF) murojaat qilinadi — brauzer
  // hech qachon to'g'ridan-to'g'ri backendga bormaydi (CORS muammosi yo'q).
  // Token httpOnly cookie'da, localStorage ishlatilmaydi (spec 10 / 12).
  poweredByHeader: false,
};

export default nextConfig;
