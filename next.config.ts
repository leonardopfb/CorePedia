import type { NextConfig } from "next";

// Política de conteúdo: tudo vem do próprio domínio. 'unsafe-inline' é necessário porque
// o repasse é um HTML único com script e estilo embutidos e o Next injeta scripts de hidratação.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  // O conteúdo fica em /content (fora de /public) e é lido em tempo de execução pelas rotas protegidas.
  // Esta opção garante que a pasta seja empacotada junto com as funções na Vercel.
  outputFileTracingIncludes: {
    "/repasse": ["./content/repasse/**/*"],
    "/repasse/[...path]": ["./content/repasse/**/*"],
    "/arquivos": ["./content/repasse/**/*"],
    "/api/agente": ["./content/repasse/repasse_md/**/*", "./content/versoes.json"],
    "/agente": ["./content/versoes.json"],
    "/versoes": ["./content/versoes.json"],
    "/versoes/comparar": [
      "./content/versoes.json",
      "./content/versoes/**/manifest.json",
      "./content/versoes/**/*.md",
      "./content/repasse/repasse_md/**/*",
      "./content/repasse/planilhas/**/*",
      "./content/repasse/*.html",
      "./content/repasse/LEIA-ME.md",
    ],
    "/v/[versao]": ["./content/versoes/**/*"],
    "/v/[versao]/[...path]": ["./content/versoes/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
