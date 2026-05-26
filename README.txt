CATÁLOGO ROBLOX CREATOR STORE - VERSÃO GITHUB + RAILWAY

Esta versão é melhor que o HTML puro porque possui um backend Node.js.
O navegador chama /api/search, e o servidor Node.js busca os dados na Roblox.
Isso ajuda a evitar bloqueio de CORS.

ARQUIVOS:
- server.js: backend Node/Express
- package.json: dependências e comando de start
- public/index.html: site principal
- .gitignore: arquivos ignorados no GitHub

COMO TESTAR NO PC:
1. Instale o Node.js.
2. Abra a pasta do projeto no terminal.
3. Rode:
   npm install
4. Depois:
   npm start
5. Abra:
   http://localhost:3000

COMO PUBLICAR NO GITHUB:
1. Crie um repositório novo no GitHub.
2. Envie estes arquivos:
   - server.js
   - package.json
   - package-lock.json, se existir
   - public/index.html
   - .gitignore
3. Faça commit.

COMO PUBLICAR NO RAILWAY:
1. Entre no Railway.
2. Clique em New Project.
3. Escolha Deploy from GitHub repo.
4. Conecte sua conta do GitHub, se pedir.
5. Escolha o repositório deste projeto.
6. O Railway detecta o package.json.
7. Ele instala as dependências e roda npm start.
8. Depois do deploy, gere/copiei o domínio público do projeto.

COMANDO DE START:
npm start

PORTA:
O servidor usa process.env.PORT automaticamente.
Isso é importante para funcionar no Railway.

OBSERVAÇÃO:
Não coloque API key secreta no index.html.
Se no futuro você quiser usar API com chave, coloque a chave nas Variables do Railway e leia pelo server.js.
