import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowed } from "@/lib/access";
import { sessaoOk } from "@/lib/sessao";
import { registroAtivo } from "@/lib/registry";
import { audit } from "@/lib/audit";

// Porteiro de TODAS as rotas. Só ficam abertas a tela de login, a de acesso negado e o Auth.js.
const PUBLIC = ["/login", "/acesso-negado", "/cadastro", "/verificar", "/esqueci-senha", "/redefinir-senha", "/api/auth", "/robots.txt", "/favicon.ico"];

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const email = (await sessaoOk(req.auth?.user)) ? req.auth?.user?.email : undefined;
  if (!email) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return NextResponse.json({ error: "não autenticado" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  // Revalida a lista a cada requisição: quem for removido perde o acesso na hora, mesmo com sessão válida.
  if (!(await isAllowed(email))) {
    // Pessoa com sessão, mas ainda sem acesso: pode ver apenas a tela de pedido de acesso.
    if (registroAtivo()) {
      if (pathname === "/solicitar-acesso" || pathname.startsWith("/solicitar-acesso/")) return NextResponse.next();
      return NextResponse.redirect(new URL("/solicitar-acesso", req.nextUrl.origin));
    }
    audit("access_revoked", { email, path: pathname });
    return NextResponse.redirect(new URL("/acesso-negado?motivo=revogado", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
