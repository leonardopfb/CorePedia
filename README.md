# CorePédia

Repasse das capacidades de negócio do novo core (Banco da Amazônia, Agência 201), publicado na Vercel com:

- **Login corporativo e lista de pessoas autorizadas.** Ninguém abre o repasse, os Markdown, os modelos Bizagi ou as planilhas sem entrar e sem estar na lista.
- **Pré-cadastro com aprovação.** A pessoa entra com a conta do banco, pede acesso informando área e motivo, e um administrador libera ou nega pela tela de administração.
- **Controle de versão do material.** Cada versão publicada fica guardada, com histórico do que mudou, comparação linha a linha e acesso às versões antigas.
- **Assistente.** Um agente que responde perguntas com base nos Markdown do repasse e mostra as fontes.

## O que tem no projeto

| Pasta ou arquivo | Para que serve |
|---|---|
| `content/repasse/` | O material: HTML do repasse, `repasse_md/` (um Markdown por capacidade), `bizagi/` (modelos `.bpm`, imagens e diagramas), `planilhas/`, `fonts/`. **Fica fora de `public/`** de propósito: só sai por rotas protegidas. |
| `auth.ts` | Login (Microsoft Entra ID, Google opcional) e regra de quem entra. |
| `proxy.ts` | Porteiro de todas as rotas. Sem login ou fora da lista, redireciona. |
| `lib/access.ts` | Listas de acesso (variáveis de ambiente e Global Config). |
| `lib/files.ts` | Entrega os arquivos com validação de caminho e streaming. |
| `app/` | Telas: login, acesso negado, início, arquivos, administração. |
| `scripts/preparar-html.mjs` | Prepara um novo HTML do repasse para este projeto. |
| `scripts/publicar-versao.mjs` | Publica uma nova versão do material (`npm run versao`). |
| `lib/registry.ts`, `lib/store.ts` | Pedidos de acesso, aprovações e histórico (Redis/Upstash). |
| `lib/versions.ts`, `content/versoes/` | Versões publicadas (cópias fechadas) e manifestos de hashes. |
| `lib/rag.ts`, `app/api/agente/` | Busca nos Markdown e rota do assistente. |
| `docs/SEGURANCA.md` | A estrutura de segurança, com riscos que continuam e checklist. |

## Como o acesso funciona (resumo)

1. A pessoa entra com a **conta Microsoft do banco** (Entra ID, só o tenant do banco, com MFA se a política do tenant exigir) ou, se for de fora, **cria uma conta com e-mail e senha** em /cadastro e confirma o e-mail por link.
2. O e-mail precisa estar liberado: nas **listas fixas** (variáveis de ambiente ou Global Config) ou **aprovado por um administrador** no pré-cadastro. E-mail bloqueado nunca entra. Sem nenhuma liberação, ninguém entra.
3. Quem entra e ainda não tem acesso só vê a tela **"Pedir acesso"** (nome, área e motivo). O e-mail do pedido vem do login, nunca do formulário.
4. O administrador vê o pedido em **/admin**, libera ou nega (com observação que a pessoa lê). Também pode liberar um e-mail diretamente e retirar acessos.
5. **Toda requisição** reconfere a liberação. Quem é removido perde o acesso em até 5 segundos (cache curto, ajustável), mesmo com sessão aberta.
6. Cada login, pedido, decisão, abertura do repasse e pergunta ao assistente vira uma linha de auditoria nos logs.

Detalhes e limites em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

---

## Configuração na Vercel, passo a passo

### 0. Antes de começar

- Use um plano **Pro ou Enterprise** da Vercel. O plano Hobby é para uso pessoal e não comercial.
- O conteúdo vai junto com o código, então o repositório no GitHub **precisa ser privado**.
- Você precisa de alguém com permissão de administrador no **Microsoft Entra ID** do banco (ou peça o cadastro do aplicativo à equipe de identidade).

### 1. Subir o código para um repositório privado

```bash
cd corepedia
git init && git add . && git commit -m "CorePédia"
git branch -M main
git remote add origin git@github.com:SUA-ORGANIZACAO/corepedia.git
git push -u origin main
```

### 2. Cadastrar o aplicativo no Microsoft Entra ID

No portal do Entra (entra.microsoft.com):

1. **Identidade > Aplicativos > Registros de aplicativo > Novo registro**.
2. Nome: `CorePédia`. Tipo de conta: **Somente contas deste diretório organizacional (locatário único)**.
3. URI de redirecionamento, plataforma **Web**: `https://SEU-DOMINIO/api/auth/callback/microsoft-entra-id`. Use o domínio definitivo (veja o passo 5). Para testar na sua máquina, adicione também `http://localhost:3000/api/auth/callback/microsoft-entra-id`.
4. Na página do aplicativo, copie **ID do aplicativo (cliente)** e **ID do diretório (locatário)**.
5. **Certificados e segredos > Novo segredo do cliente**. Copie o **Valor** na hora (ele some depois). Anote a data de expiração e crie um lembrete para renovar antes.
6. **Aplicativos empresariais > CorePédia > Propriedades > Atribuição obrigatória = Sim**, e em **Usuários e grupos** adicione quem deve acessar. Isso cria uma segunda trava, no próprio Microsoft, além da lista do projeto.
7. Se o banco usa Acesso Condicional, peça para incluir este aplicativo na política de MFA.

### 3. Criar o projeto na Vercel

1. **Add New > Project**, importe o repositório. O framework **Next.js** é detectado sozinho. Não mude comando de build.
2. Antes de clicar em Deploy, abra **Environment Variables** e cadastre, para **Production** (marque como *Sensitive* as que são segredo):

| Variável | Valor |
|---|---|
| `AUTH_SECRET` | resultado de `openssl rand -base64 33` |
| `AUTH_URL` | `https://SEU-DOMINIO` |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | ID do aplicativo (cliente) |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | valor do segredo do cliente |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<ID-DO-LOCATARIO>/v2.0` |
| `ADMIN_EMAILS` | seus e-mails de administrador, separados por vírgula |
| `ALLOWED_EMAILS` | e-mails liberados como leitores (pode ficar vazio se usar domínio) |
| `ALLOWED_DOMAINS` | por exemplo `basa.com.br` (libera todo o domínio) |
| `BLOCKED_EMAILS` | e-mails que nunca entram (opcional) |
| `ACCESS_CONTACT` | contato mostrado na tela de acesso negado |
| `SELF_REGISTRATION` | `on` (padrão) ou `off` para desligar o pré-cadastro |
| `REGISTRATION_DOMAINS` | opcional: só estes domínios podem pedir acesso (obrigatório se usar Google) |
| `NOTIFY_WEBHOOK_URL` | opcional: webhook que recebe um aviso a cada novo pedido |
| `RESEND_API_KEY`, `MAIL_FROM` | envio dos e-mails de confirmação e redefinição de senha (passo 9) |
| `CADASTRO_ABERTO` | `on` (padrão) ou `off`: liga/desliga cadastro e login por senha |
| `CADASTRO_DOMINIOS_BLOQUEADOS` | opcional: provedores de e-mail recusados no cadastro |
| `ANTHROPIC_API_KEY` | chave da API para o assistente (passo 10) |
| `ANTHROPIC_MODEL` | opcional; padrão `claude-sonnet-5-5` (use `claude-haiku-5-5` para custo menor) |
| `AGENT_LIMIT_PER_HOUR` | opcional; perguntas por pessoa por hora (padrão 30) |

   Não cadastre `DEV_LOGIN_ENABLED` na Vercel. Esse login de teste não existe em produção de qualquer forma.
3. Clique em **Deploy**.

> O `ISSUER` precisa conter o ID do locatário. Se apontar para `common`, `organizations` ou `consumers`, o projeto se recusa a subir, de propósito: seria aceitar contas de fora do banco.

### 4. Região das funções (opcional)

O `vercel.json` já pede a região `gru1` (São Paulo). Se a Vercel recusar a região no seu plano, apague a linha `regions`.

### 5. Domínio definitivo

1. **Settings > Domains > Add**, por exemplo `corepedia.seudominio.com.br`, e siga a orientação de DNS.
2. Confirme que o `AUTH_URL` e o URI de redirecionamento do Entra usam exatamente esse domínio. Faça novo deploy se mudar o `AUTH_URL`.
3. Use um único endereço oficial. O endereço `*.vercel.app` do projeto não está registrado no Entra e o login por ele vai falhar, o que é o esperado.

### 6. Proteção de deploys da Vercel

Em **Settings > Deployment Protection**, mantenha a proteção padrão (Vercel Authentication) ligada para os deploys de **Preview**, para que ninguém abra versões de teste sem conta Vercel do time. **Não** use essa proteção como login dos usuários finais: eles não têm conta Vercel. Quem protege o acesso de produção é o login deste projeto.

### 7. (Recomendado) Conceder e retirar acesso sem novo deploy: Global Config

Alterar `ALLOWED_EMAILS` exige salvar a variável e fazer novo deploy. Para mudar na hora, sem deploy:

1. **Storage > Create > Global Config** (antigo Edge Config). Nome: `corepedia-acesso`.
2. Conecte ao projeto. A Vercel cria a variável `GLOBAL_CONFIG` sozinha. Faça um novo deploy para ela valer.
3. No Global Config, crie estes itens (valores em lista JSON):

```json
{
  "allowedEmails": ["ana.souza@basa.com.br", "carlos.lima@basa.com.br"],
  "allowedDomains": [],
  "blockedEmails": [],
  "adminEmails": []
}
```

As listas do Global Config **somam** com as variáveis de ambiente. Se o Global Config estiver conectado e falhar na leitura, o projeto **nega** o acesso (falha fechada) e registra `access_check_error` nos logs.

### 8. Pré-cadastro: conectar um Redis (Upstash)

O pedido de acesso, a lista de aprovados e o histórico precisam de um armazenamento. Sem ele, o pré-cadastro fica desligado (a tela de administração avisa) e valem só as listas fixas.

1. Na Vercel, **Storage > Create** (ou **Marketplace**) e escolha **Upstash for Redis**. Crie o banco na região mais próxima de `gru1` e conecte ao projeto.
2. A integração cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (o projeto também aceita `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`). Faça novo deploy.
3. Entre como administrador e abra **/admin**: o aviso de "pré-cadastro desligado" some.
4. Opcional: configure `NOTIFY_WEBHOOK_URL` com um webhook do Teams (fluxo "Workflows") ou do Slack para ser avisado a cada pedido. O formato enviado é `{"text": "..."}`; se o seu webhook exige outro formato, ajuste `lib/notify.ts`.
5. Para pedir acesso, a pessoa precisa antes **entrar** com a conta do banco. Quem não for do tenant não chega a pedir. Se usar login Google, defina `REGISTRATION_DOMAINS` (por exemplo `basa.com.br`).

### 9. Cadastro aberto com e-mail e senha

Qualquer pessoa pode criar uma conta em **/cadastro** usando o e-mail como login e uma senha. O acesso só abre **depois da aprovação do administrador**.

**Fluxo:** a pessoa preenche nome, e-mail, área, motivo e senha → recebe um link de confirmação por e-mail (vale 24 horas) → ao confirmar, o pedido aparece para o administrador com a marca "e-mail confirmado" → o administrador libera em **/admin** → a pessoa entra em **/login** e o material abre. O administrador **não consegue aprovar** quem ainda não confirmou o e-mail (isso impede que alguém cadastre o e-mail de outra pessoa com uma senha própria e herde o acesso quando o administrador aprovar).

**O que configurar:**

1. **Redis (Upstash):** já descrito no passo 8. O cadastro precisa dele para guardar contas, pedidos e links.
2. **Envio de e-mail:** o projeto usa o [Resend](https://resend.com) pela API HTTP. Crie uma conta, verifique o domínio de envio (SPF e DKIM) e cadastre na Vercel:
   - `RESEND_API_KEY` (Sensitive)
   - `MAIL_FROM`, por exemplo `CorePédia <acesso@seudominio.com.br>`
   Se o banco preferir outro provedor (SMTP, SES, Microsoft Graph), troque só o arquivo `lib/mail.ts`.
3. **Sem e-mail configurado em produção, o cadastro fica fechado** (a página avisa). Não há como confirmar e-mail sem enviar e-mail.
4. `CADASTRO_ABERTO=off` desliga o cadastro e o login por senha. `CADASTRO_DOMINIOS_BLOQUEADOS` bloqueia provedores descartáveis (por exemplo `mailinator.com,10minutemail.com`).

**O que o projeto faz para proteger as contas:**

- Senha de no mínimo 12 caracteres, sem lista de regras de composição; recusa senhas comuns, repetitivas, só numéricas ou que contenham o e-mail ou o nome.
- Senha guardada apenas como hash **scrypt** com sal próprio; nunca em texto, nem nos logs.
- Conta só entra com e-mail confirmado. Cinco senhas erradas travam a conta por 15 minutos; há limite por IP.
- Cadastro, confirmação e "esqueci a senha" respondem igual exista ou não o e-mail (não revelam quem já tem conta). Um novo cadastro com e-mail já existente **nunca troca a senha**.
- Limites contra uso em massa: 6 cadastros por hora por IP e 3 por e-mail (evita encher a caixa de uma pessoa), campo-isca contra robôs e fila máxima de 300 pedidos pendentes.
- Links de confirmação e de redefinição são de uso único e guardados só como hash. Trocar a senha **encerra todas as sessões abertas** com a senha antiga.

> **Importante:** esse caminho é mais fraco que o login corporativo. Não há MFA, e a pessoa não é um funcionário do banco. A barreira real é a **sua aprovação**: confira quem é a pessoa (área, motivo, e-mail) antes de liberar, e prefira liberar só quem você consegue identificar. Se a aprovação precisar de mais rigor, considere exigir contato prévio por outro canal.

### 10. Assistente: chave da API

1. Crie uma chave em console.anthropic.com e cadastre `ANTHROPIC_API_KEY` na Vercel (Sensitive).
2. Faça novo deploy e abra **/agente**. Sem a chave, o assistente funciona em modo busca: mostra os trechos mais relevantes dos Markdown, sem resposta redigida.
3. Defina um limite de gasto na própria conta da Anthropic. O projeto também limita 30 perguntas por pessoa por hora.

> **Atenção de governança:** ao perguntar, os trechos do material que respondem à pergunta são enviados à API da Anthropic. Antes de ligar o assistente, obtenha a aprovação de segurança e compliance do banco para esse envio. O material do repasse não traz dados de clientes, mas é interno.

### 11. (Recomendado) Limitar tentativas: Firewall da Vercel

Em **Firewall**, crie uma regra de limite de taxa para o caminho `/api/auth/*` (por exemplo, 20 requisições por minuto por IP). Com login único (SSO) o risco de força bruta é baixo, mas a regra custa pouco.

### 12. Teste de aceitação (faça antes de divulgar)

| Teste | Resultado esperado |
|---|---|
| Abrir `https://SEU-DOMINIO/repasse` em janela anônima | vai para a tela de login |
| Entrar com e-mail liberado | abre o início; `/repasse` carrega o HTML completo |
| Entrar com conta do banco fora da lista | tela "Pedir acesso" (e nenhuma rota abre) |
| Enviar o pedido e abrir `/admin` como administrador | o pedido aparece com nome, área e motivo |
| Abrir /cadastro em janela anônima, criar uma conta e abrir o link recebido por e-mail | "E-mail confirmado"; o pedido aparece no /admin como confirmado |
| Entrar com a conta nova antes de aprovar | só a tela "Pedido em análise"; nenhuma rota abre |
| Tentar aprovar um pedido cujo e-mail não foi confirmado | o botão fica desabilitado |
| Errar a senha 5 vezes | a conta trava por 15 minutos |
| "Esqueci minha senha" e trocar a senha | o link só funciona uma vez; sessões antigas caem |
| Liberar o pedido e recarregar como a pessoa | o repasse abre |
| Retirar o acesso e recarregar como a pessoa | volta para "Pedir acesso", em até 5 segundos |
| Abrir `/agente` e perguntar "O que é a capacidade de conta poupança?" | resposta com fontes (GPB-119) |
| Abrir `/versoes` e comparar duas versões | lista de arquivos alterados e diferenças linha a linha |
| Abrir `/repasse/bizagi/...` ou `/repasse/repasse_md/...` sem login | vai para o login |
| Remover seu e-mail da lista e recarregar | acesso negado na hora |
| Entrar com administrador e abrir `/admin` | mostra as listas; leitor recebe 404 |
| Vercel > Logs, filtrar por `audit` | aparecem `signin_ok`, `signin_denied`, `content_open` |

---

## Controle de versão do material

**Ideia:** o conteúdo atual fica em `content/repasse/` (o "rascunho"). Quando a equipe decide que ele está pronto, publica-se uma **versão**: uma cópia fechada dos Markdown, das planilhas e do HTML em `content/versoes/<n.n.n>/`, com manifesto de hashes (SHA-256) e registro do que mudou. Versões publicadas nunca são alteradas ou sobrescritas.

**Publicar uma versão:**

```bash
# 1) atualize os arquivos em content/repasse (HTML, repasse_md, planilhas)
# 2) publique a versão (patch, minor, major ou número explícito)
npm run versao -- minor "Inclui a capacidade X e corrige os drops da TED" --autor "Seu Nome" --git
# 3) envie ao GitHub; a Vercel publica sozinha
git push && git push --tags
```

- `--git` cria o commit "Versão X: notas" e a tag `vX`. Sem ele, o script mostra os comandos para fazer à mão.
- `--sem-html` guarda só Markdown e planilhas (o HTML pesa 8,5 MB por versão; use quando só o texto mudou).
- O script recusa repetir um número de versão, recusar número menor que o atual e exige as notas.
- Use `patch` para correções, `minor` para novos conteúdos, `major` para mudança de estrutura.

**No site:**

- **/versoes** lista as versões com data, autor, notas e contagem de arquivos adicionados, alterados e removidos. Cada versão abre o repasse da época (`/v/<versão>`) e o índice de Markdown.
- **/versoes/comparar** compara duas versões, ou uma versão com o **rascunho** (o que mudou desde a última publicação), e mostra as diferenças linha a linha dos Markdown.
- O assistente e o início mostram a versão atual.
- O repasse de uma versão antiga usa, para os modelos Bizagi e as imagens, os arquivos do conteúdo atual.

**Voltar atrás:** a Vercel guarda cada deploy. Em **Deployments**, use *Promote to Production* no deploy anterior para reverter na hora, ou faça `git revert` e novo push. As versões antigas continuam acessíveis em `/versoes` de qualquer forma.

**Tamanho:** cada versão com HTML soma cerca de 9 MB. Para muitas versões, use `--sem-html` na maioria e mantenha o HTML só nas versões marcantes.

## Operação do dia a dia

**Liberar acesso:** peça à pessoa para entrar e enviar o pedido, e aprove em **/admin**. Ou use "Liberar um e-mail diretamente" na mesma tela. Para listas fixas, use `ALLOWED_EMAILS`/`ALLOWED_DOMAINS` (precisa de deploy) ou o Global Config (vale em segundos).
**Retirar acesso:** "Retirar acesso" em **/admin**. Se a pessoa estiver nas listas fixas, retire de lá também, e inclua em `blockedEmails` se for urgente (bloqueio tem prioridade sobre tudo). Retire também a pessoa em *Usuários e grupos* do aplicativo no Entra.
**Ver quem acessou e quem perguntou:** Vercel > Logs, busca por `audit`. Cada linha é um JSON com data, evento e e-mail. Os eventos são `signin_ok`, `signin_pendente`, `signin_denied`, `solicitacao_criada`, `solicitacao_aprovada`, `solicitacao_negada`, `acesso_revogado_admin`, `acesso_liberado_manual`, `content_open`, `content_denied`, `agente_pergunta` e `agente_limite`. Nunca há senha, token, cookie, nem o texto das perguntas.
**Renovar o segredo do Entra:** crie um novo segredo, atualize `AUTH_MICROSOFT_ENTRA_ID_SECRET`, faça deploy e só então apague o antigo.
**Trocar `AUTH_SECRET`:** todas as sessões caem e as pessoas entram de novo. Faça se houver suspeita de vazamento.
**Atualizar o conteúdo:** veja "Controle de versão" acima. Se o HTML for um arquivo novo gerado fora do projeto, rode antes `node scripts/preparar-html.mjs caminho/do/arquivo.html`.

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local    # preencha AUTH_SECRET e, para testar sem Entra, DEV_LOGIN_ENABLED=true e ALLOWED_EMAILS=voce@teste.local
npm run dev                    # http://localhost:3000
```

Em desenvolvimento, o pré-cadastro grava em `.data/store.json` (ignorado pelo Git), sem precisar do Redis. Os e-mails de confirmação e de redefinição não são enviados: ficam em `.data/emails.log` e aparecem no terminal, com o link. Para testar o assistente sem gastar chave, deixe `ANTHROPIC_API_KEY` vazia: ele mostra os trechos encontrados.

O login de desenvolvimento (`DEV_LOGIN_ENABLED=true`) só funciona fora de produção e passa pela mesma lista de acesso.

## Observações técnicas

- O HTML do repasse tem cerca de 8,5 MB. A Vercel limita respostas de função a 4,5 MB, então ele é entregue em **streaming**, que não tem esse limite. Não mova o arquivo para `public/` nem troque por resposta única.
- `outputFileTracingIncludes` no `next.config.ts` garante que `content/` seja empacotado com as funções.
- Next.js 16: o porteiro é o arquivo `proxy.ts` (antigo `middleware.ts`).
- As páginas protegidas conferem o acesso por conta própria (`requireAccess`), além do `proxy.ts`: o redirecionamento de uma ação de login renderiza a página sem passar pelo proxy.
- O assistente usa busca BM25 em memória sobre os Markdown (sem serviço de vetores). O índice é montado na primeira pergunta de cada instância.
- Global Config é o novo nome do Edge Config (pacote `@vercel/global-config`). Projetos antigos com `EDGE_CONFIG` continuam funcionando: o código lê `GLOBAL_CONFIG` e, se não houver, `EDGE_CONFIG`.
