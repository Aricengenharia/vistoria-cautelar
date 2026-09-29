# Vistoria Cautelar

Aplicativo móvel e aplicação web para execução de inspeções cautelares em casas, apartamentos, áreas comuns, prédios e comércios.

## O que o projeto inclui

- Aplicativo Expo para Android, iOS e tablet;
- Formulário web com o mesmo fluxo de vistoria;
- Autenticação local por e-mail e senha;
- Controle de usuários, perfis e permissões;
- Workflow: **Em elaboração → Concluído → Conferido → Aprovado**;
- Registro do vistoriador, conferente e aprovador;
- Fotos por ambiente e pastas lógicas de mídia;
- Croqui, assinaturas e exportação de relatório PDF;
- Galeria administrativa por vistoria, ambiente e seção;
- PostgreSQL/MySQL compatível com Drizzle ORM conforme a configuração do ambiente.

## Segurança

Este repositório deve permanecer sem dados reais de clientes. Não publique:

- arquivos `.env` ou credenciais;
- senha ou hash de senha de produção;
- fotos, assinaturas ou documentos de imóveis;
- dumps do banco de dados;
- tokens de armazenamento ou APIs.

Os administradores são configurados pelo segredo `ADMIN_EMAILS`, separado por vírgulas. A senha inicial deve ser criada somente pelo painel ou por procedimento seguro do ambiente de produção.

## Configuração local

1. Instale Node.js 22 e pnpm 9.
2. Copie o exemplo de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Preencha os segredos no `.env` sem versioná-lo.
4. Instale as dependências e valide o projeto:

   ```bash
   pnpm install
   pnpm check
   pnpm test
   ```

5. Execute o desenvolvimento:

   ```bash
   pnpm dev
   ```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão do banco do servidor |
| `JWT_SECRET` | assinatura das sessões locais |
| `ADMIN_EMAILS` | e-mails administrativos autorizados, separados por vírgula |
| `VITE_APP_ID` | identificação pública do aplicativo |
| `OAUTH_SERVER_URL` | servidor OAuth legado, se habilitado |
| `OWNER_OPEN_ID` | identificador do proprietário do ambiente |
| `BUILT_IN_FORGE_API_URL` | endpoint interno opcional |
| `BUILT_IN_FORGE_API_KEY` | chave interna opcional |

## Banco e migrações

As migrações versionadas ficam em `drizzle/`. Antes de aplicar uma migração em produção, faça backup e revise o SQL:

```bash
pnpm drizzle-kit generate
pnpm db:push
```

## Mídias

As fotos são enviadas para o armazenamento de arquivos configurado no servidor. O caminho lógico segue a organização abaixo:

```text
inspections/{usuario}/{codigo-da-vistoria}/
├── 01-fotos/{ambiente}/
├── 02-croqui/
├── 03-projeto-planta/
└── 04-tentativas-entrada/
```

O banco guarda os metadados da vistoria e as referências das mídias; os arquivos de imagem não devem ser incluídos no Git.

## Scripts principais

- `pnpm dev` — servidor e Expo web em desenvolvimento;
- `pnpm check` — checagem TypeScript;
- `pnpm test` — testes Vitest;
- `pnpm build` — exportação web e build do servidor;
- `pnpm android` — iniciar no Android;
- `pnpm ios` — iniciar no iOS.

## Publicação

Para publicar o app web, configure as variáveis do servidor e use uma hospedagem Node compatível com o build. Para publicar o app móvel, gere os binários Expo/EAS usando as credenciais das lojas fora deste repositório.
