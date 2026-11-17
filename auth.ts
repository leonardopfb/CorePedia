import NextAuth, { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { emailFrom, isAllowed, isBlocked, normalize, roleOf } from "@/lib/access";
import { autenticar, loginSenhaDisponivel } from "@/lib/contas";
import { podeSolicitar } from "@/lib/registry";
import { audit } from "@/lib/audit";

const isProd = process.env.NODE_ENV === "production";
const providers: NextAuthConfig["providers"] = [];
const ids: string[] = []; // identificadores dos métodos de login ativos (usado pela tela de login)

// Microsoft Entra ID (login corporativo). O emissor precisa ser o do tenant do banco.
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  if (isProd && (!issuer || /\/(common|organizations|consumers)\//.test(issuer))) {
    throw new Error(
      "AUTH_MICROSOFT_ENTRA_ID_ISSUER deve apontar para o tenant do banco (https://login.microsoftonline.com/<tenant-id>/v2.0).",
    );
  }
  ids.push("microsoft-entra-id");
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer,
    }),
  );
}

// Google (opcional). A lista de acesso continua valendo.
if (process.env.AUTH_GOOGLE_ID) {
  ids.push("google");
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}

// E-mail e senha (cadastro aberto). A conta só entra depois de confirmar o e-mail; o conteúdo só abre após a aprovação.
if (loginSenhaDisponivel()) {
  ids.push("senha");
  providers.push(
    Credentials({
      id: "senha",
      name: "E-mail e senha",
      credentials: { email: { label: "E-mail", type: "email" }, password: { label: "Senha", type: "password" } },
      authorize: async (c, request) => {
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
        const u = await autenticar(String(c?.email ?? ""), String(c?.password ?? ""), ip);
        return u ? { id: u.email, email: u.email, name: u.nome, pv: u.pv } : null;
      },
    }),
  );
}

// Login de desenvolvimento: só existe fora de produção e com DEV_LOGIN_ENABLED=true.
if (!isProd && process.env.DEV_LOGIN_ENABLED === "true") {
  ids.push("dev");
  providers.push(
    Credentials({
      id: "dev",
      name: "Desenvolvimento",
      credentials: { email: { label: "E-mail", type: "email" } },
      authorize: async (c) => {
        const email = normalize(String(c?.email ?? ""));
        return email ? { id: email, email, name: email } : null;
      },
    }),
  );
}

export const providerIds: string[] = ids;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = emailFrom(user, profile as Record<string, unknown> | undefined);
      // Google: só e-mail verificado.
      if (account?.provider === "google" && (profile as Record<string, unknown> | undefined)?.email_verified !== true) {
        audit("signin_denied", { email, provider: account.provider, reason: "email_nao_verificado" });
        return "/acesso-negado";
      }
      if (await isBlocked(email)) {
        audit("signin_denied", { email, provider: account?.provider, reason: "bloqueado" });
        return "/acesso-negado";
      }
      if (await isAllowed(email)) return true;
      // Fora da lista: com o pré-cadastro ativo, a sessão é criada só para a pessoa pedir acesso.
      // O conteúdo continua fechado: o porteiro e as rotas conferem a lista a cada requisição.
      if (podeSolicitar(email, account?.provider)) {
        audit("signin_pendente", { email, provider: account?.provider });
        return true;
      }
      audit("signin_denied", { email, provider: account?.provider, reason: "fora_da_lista" });
      return "/acesso-negado";
      return true;
    },
    async jwt({ token, user, profile, account }) {
      if (user) {
        token.via = account?.provider === "senha" ? "senha" : "sso";
        token.pv = (user as { pv?: number }).pv;
        const email = emailFrom(user, profile as Record<string, unknown> | undefined);
        token.email = email;
        token.role = await roleOf(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = token.role as "admin" | "viewer" | undefined;
        session.user.via = token.via as "sso" | "senha" | undefined;
        session.user.pv = token.pv as number | undefined;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      audit("signin_ok", { email: emailFrom(user, profile as Record<string, unknown> | undefined), provider: account?.provider });
    },
    async signOut(message) {
      const email = "token" in message ? (message.token?.email as string | undefined) : undefined;
      audit("signout", { email });
    },
  },
});
