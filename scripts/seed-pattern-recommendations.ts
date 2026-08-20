// scripts/seed-pattern-recommendations.ts
import { connectToDatabase } from '../lib/mongodb';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

// Mapeamento completo baseado no JSON fornecido.
// 'description' contém a justificativa técnica (Por que isso é um problema?)
// 'recommendation' contém a solução e exemplos de código (Como corrigir?)
const patternsData: Record<string, { description: string; recommendation: string }> = {
  // ===========================
  // 🛡️ SQL INJECTION
  // ===========================
  "SQL Injection (concatenação) - C#": {
    description: "A concatenação de strings para construir consultas SQL em C# permite a manipulação da query original por meio de entradas de usuário. Isso expõe a aplicação a ataques de **SQL Injection**, onde um invasor pode executar comandos arbitrários no banco de dados, resultando em vazamento, corrupção ou exclusão de dados críticos.",
    recommendation: "**Solução:** Utilize sempre comandos parametrizados (`SqlParameter`) ou um ORM robusto como o Entity Framework Core.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nstring query = \"SELECT * FROM Usuarios WHERE Id = \" + idUsuario;\n```\n\n✅ **Código Seguro (com ADO.NET):**\n```csharp\nvar sql = \"SELECT * FROM Usuarios WHERE Id = @Id\";\nusing (var cmd = new SqlCommand(sql, connection)) {\n    cmd.Parameters.AddWithValue(\"@Id\", idUsuario);\n}\n```\n\n✅ **Código Seguro (com Entity Framework):**\n```csharp\nvar usuario = await context.Usuarios.FirstOrDefaultAsync(u => u.Id == idUsuario);\n```"
  },
  "SQL Injection (concatenação) - Java": {
    description: "Em Java, a concatenação de strings em consultas SQL é uma vulnerabilidade clássica de **SQL Injection**, permitindo que atacantes manipulem a lógica da consulta através de parâmetros HTTP ou entradas de formulários.",
    recommendation: "**Solução:** Utilize a classe `PreparedStatement` para parametrizar as queries de forma nativa.\n\n❌ **Código Inseguro (Evite):**\n```java\nString sql = \"SELECT * FROM Produtos WHERE Nome = '\" + nome + \"'\";\n```\n\n✅ **Código Seguro:**\n```java\nString sql = \"SELECT * FROM Produtos WHERE Nome = ?\";\nPreparedStatement pstmt = connection.prepareStatement(sql);\npstmt.setString(1, nome);\nResultSet rs = pstmt.executeQuery();\n```"
  },
  "SQL Injection (String.Format) - C#": {
    description: "O uso de `String.Format` para construir consultas SQL em C# é uma prática extremamente perigosa. Embora pareça uma formatação inofensiva, ela permite a injeção de SQL se os dados do usuário forem concatenados diretamente na string formatada.",
    recommendation: "**Solução:** Substitua o uso de `String.Format` por parâmetros SQL. A melhor abordagem é abstrair a lógica de acesso a dados para um ORM.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nstring sql = String.Format(\"SELECT * FROM Logs WHERE Data = '{0}'\", dataEntrada);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar sql = \"SELECT * FROM Logs WHERE Data = @Data\";\ncmd.Parameters.AddWithValue(\"@Data\", dataEntrada);\n```"
  },
  "SQL Injection (template strings) - JavaScript/TypeScript": {
    description: "O uso de template strings (`` `...` ``) para construir consultas SQL em aplicações Node.js ou TypeScript é uma vulnerabilidade grave que pode ser explorada para **SQL Injection**, comprometendo todo o banco de dados.",
    recommendation: "**Solução:** Utilize sempre um ORM (como Prisma, TypeORM ou Sequelize) ou, se estiver usando `mysql2`/`pg` diretamente, utilize a parametrização nativa com placeholders (`?` ou `$1`).\n\n❌ **Código Inseguro (Evite):**\n```javascript\nconst query = `SELECT * FROM Users WHERE email = '${email}'`;\n```\n\n✅ **Código Seguro (com bibliotecas PG):**\n```javascript\nconst query = 'SELECT * FROM Users WHERE email = $1';\nconst values = [email];\nconst result = await client.query(query, values);\n```"
  },

  // ===========================
  // 🛡️ COMMAND INJECTION
  // ===========================
  "Command Injection - C#": {
    description: "O uso da classe `Process.Start()` para executar comandos no sistema operacional com argumentos não sanitizados ou fornecidos pelo usuário é o principal vetor para **Command Injection**. Um atacante pode executar comandos arbitrários com as permissões da aplicação.",
    recommendation: "**Solução:** Sempre que possível, evite `Process.Start()`. Se necessário, utilize a sobrecarga que recebe o comando e os argumentos separadamente, e nunca permita a entrada arbitrária do usuário em parâmetros de shell.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nProcess.Start(\"cmd.exe\", \"/c \" + comandoUsuario);\n```\n\n✅ **Código Seguro:**\n```csharp\n// Utilize um array de argumentos, nunca concatenando\nProcess.Start(\"ping\", new string[] { \"-c\", \"4\", \"8.8.8.8\" });\n```"
  },
  "Command Injection - Java": {
    description: "Em Java, a execução de comandos do sistema usando `Runtime.getRuntime().exec()` com entradas do usuário é uma vulnerabilidade de **Command Injection**. Um atacante pode quebrar o comando esperado e executar código malicioso no servidor.",
    recommendation: "**Solução:** Prefira usar `ProcessBuilder` com uma lista de argumentos em vez de uma única string. Isso evita a interpretação do shell e torna a injeção de comandos extremamente difícil, se não impossível.\n\n❌ **Código Inseguro (Evite):**\n```java\nRuntime.getRuntime().exec(\"ls -l \" + diretorio);\n```\n\n✅ **Código Seguro:**\n```java\nnew ProcessBuilder(\"ls\", \"-l\", diretorio).start();\n```"
  },
  "Command Injection - Python": {
    description: "Em Python, funções como `os.system()`, `subprocess.call()`, e `subprocess.Popen()` podem sofrer de **Command Injection** se argumentos do usuário forem passados diretamente para o shell.",
    recommendation: "**Solução:** Utilize `subprocess.run()` com o parâmetro `shell=False` (que é o padrão) e passe os argumentos como uma lista. Evite `shell=True` em ambientes de produção.\n\n❌ **Código Inseguro (Evite):**\n```python\nimport os\nos.system(\"rm -rf \" + path)\n```\n\n✅ **Código Seguro:**\n```python\nimport subprocess\nsubprocess.run([\"rm\", \"-rf\", path])\n```"
  },
  "Command Injection - Node.js": {
    description: "Em Node.js, a execução de comandos de sistema via `child_process` com strings concatenadas é uma porta de entrada para **Command Injection**, permitindo que um atacante execute código arbitrário no servidor.",
    recommendation: "**Solução:** Sempre use `execFile`, `spawn`, ou `fork`, que aceitam argumentos como um array e não invocam o shell automaticamente.\n\n❌ **Código Inseguro (Evite):**\n```javascript\nconst { exec } = require('child_process');\nexec('ls -l ' + dir);\n```\n\n✅ **Código Seguro:**\n```javascript\nconst { spawn } = require('child_process');\nspawn('ls', ['-l', dir]);\n```"
  },

  // ===========================
  // 🔒 HARDCODED SECRETS
  // ===========================
  "Hardcoded Password/Secret - Geral": {
    description: "Senhas, chaves de API e outros segredos não devem ser armazenados no código-fonte. Se o repositório for comprometido (público ou vazado), todas as credenciais serão expostas, dando acesso irrestrito a sistemas externos e internos.",
    recommendation: "**Solução:** Utilize ferramentas de gerenciamento de segredos (como Azure Key Vault, AWS Secrets Manager, ou HashiCorp Vault) e variáveis de ambiente para injetar as credenciais em tempo de execução.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nstring connectionString = \"Server=myServer;Database=myDB;User Id=sa;Password=P@ssw0rd;\";\n```\n\n✅ **Código Seguro:**\n```csharp\nstring connectionString = Environment.GetEnvironmentVariable(\"DB_CONNECTION_STRING\");\n```"
  },
  "Hardcoded API Key/Token": {
    description: "Chaves de API (como tokens de integração, chaves de terceiros) hardcoded no código são extremamente arriscadas. Uma vez expostas, um atacante pode usar essas chaves para acessar serviços pagos ou sistemas internos com privilégios elevados.",
    recommendation: "**Solução:** Adote o uso de `Environment Variables` ou serviços de segredos para carregar essas chaves apenas em tempo de execução.\n\n❌ **Código Inseguro (Evite):**\n```javascript\nconst apiKey = \"sk-live-1234567890abcdef\";\n```\n\n✅ **Código Seguro:**\n```javascript\nconst apiKey = process.env.STRIPE_API_KEY;\n```"
  },
  "Hardcoded Connection String - Config files": {
    description: "Strings de conexão com banco de dados que contém senhas armazenadas em arquivos de configuração (como `appsettings.json` ou `web.config`) representam um vetor de risco. Esses arquivos podem ser commitados acidentalmente ou expostos em servidores mal configurados.",
    recommendation: "**Solução:** Utilize `User Secrets` em desenvolvimento e variáveis de ambiente (ou Azure App Settings) em produção. O arquivo de configuração pode conter a string de conexão, mas sem a senha, que é injetada via configuração secreta.\n\n✅ **Configuração Segura:**\n```json\n{\n  \"ConnectionStrings\": {\n    \"DefaultConnection\": \"Server=tcp:server.database.windows.net;Database=MyDb;User Id=user;Password={SECRET_PASSWORD};\"\n  }\n}\n```\n*O `{SECRET_PASSWORD}` seria substituído por uma variável de ambiente.*"
  },
  "JWT Hardcoded": {
    description: "A presença de tokens JWT hardcoded no código-fonte é extremamente perigosa. Tokens como `Bearer eyJ...` podem conceder acesso a APIs ou serviços sensíveis se forem vazados ou não revogados.",
    recommendation: "**Solução:** Tokens JWT nunca devem ser commitados. Eles devem ser obtidos dinamicamente através de um fluxo de autenticação ou carregados de um cofre de segredos.\n\n❌ **Código Inseguro (Evite):**\n```python\nAPI_HEADERS = {\n    \"Authorization\": \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"\n}\n```\n\n✅ **Código Seguro:**\n```python\nAPI_HEADERS = {\n    \"Authorization\": f\"Bearer {os.getenv('ACCESS_TOKEN')}\"\n}\n```"
  },
  "Private Key Hardcoded": {
    description: "Chaves privadas RSA ou outras chaves criptográficas são o coração da segurança de dados. Armazená-las no código (especialmente em repositórios públicos) é uma falha catastrófica que permite a um atacante descriptografar comunicações ou forjar tokens de autenticação.",
    recommendation: "**Solução:** Jamais armazene chaves privadas em texto plano no código. Utilize um mecanismo de segredo como Azure Key Vault e referencie-as por identificadores.\n\n❌ **Código Inseguro (Evite):**\n```text\n-----BEGIN RSA PRIVATE KEY-----\nMIIJKQIBAAKCAgE...\n```\n\n✅ **Código Seguro:**\n```csharp\nvar key = await keyVaultClient.GetSecretAsync(\"[https://myvault.vault.azure.net/secrets/MyPrivateKey](https://myvault.vault.azure.net/secrets/MyPrivateKey)\");\n```"
  },

  // ===========================
  // 🛡️ WEAK CRYPTOGRAPHY
  // ===========================
  "Weak Hashing (MD5) - C#": {
    description: "O uso de algoritmos de hashing considerados obsoletos e inseguros como MD5 e SHA-1 é um grave problema de criptografia. Esses algoritmos são vulneráveis a ataques de colisão, permitindo que um invasor crie dados que geram o mesmo hash, comprometendo a integridade de assinaturas ou senhas.",
    recommendation: "**Solução:** Substitua os algoritmos fracos por algoritmos modernos como SHA-256 ou SHA-512.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nvar hash = MD5.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```\n\n✅ **Código Seguro:**\n```csharp\nvar hash = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```"
  },
  "Weak Hashing (SHA1) - C#": {
    description: "SHA-1 é um algoritmo de hash que não é mais considerado seguro para ambientes de produção. Ataques de colisão práticos já foram demonstrados, tornando sua utilização uma vulnerabilidade de segurança.",
    recommendation: "**Solução:** Adote algoritmos da família SHA-2 (SHA-256, SHA-512).\n\n❌ **Código Inseguro (Evite):**\n```csharp\nvar hash = SHA1.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```\n\n✅ **Código Seguro:**\n```csharp\nvar hash = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```"
  },
  "Weak Encryption (DES) - C#": {
    description: "O DES (Data Encryption Standard) é um algoritmo de criptografia simétrica extremamente antigo e frágil. Sua chave de 56 bits é considerada trivial de ser quebrada com hardware moderno. A utilização deste algoritmo expõe os dados criptografados a ataques de força bruta.",
    recommendation: "**Solução:** Substitua por algoritmos modernos como AES (Advanced Encryption Standard) com chaves de pelo menos 256 bits.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nvar des = DESCryptoServiceProvider.Create();\n```\n\n✅ **Código Seguro:**\n```csharp\nvar aes = Aes.Create();\naes.KeySize = 256;\n```"
  },
  "Weak Hashing (MD5/SHA1) - Java": {
    description: "Em Java, o uso de `MessageDigest` com `MD5` ou `SHA-1` é considerado uma vulnerabilidade de criptografia. Esses algoritmos têm falhas conhecidas de segurança e não devem mais ser utilizados.",
    recommendation: "**Solução:** Utilize `MessageDigest` com `SHA-256` (ou superior) para operações de hashing.\n\n❌ **Código Inseguro (Evite):**\n```java\nMessageDigest md = MessageDigest.getInstance(\"MD5\");\n```\n\n✅ **Código Seguro:**\n```java\nMessageDigest md = MessageDigest.getInstance(\"SHA-256\");\n```"
  },
  "Weak Hashing (MD5) - Python": {
    description: "Em Python, a biblioteca `hashlib` com `md5` é um sinal de alerta imediato para a engenharia de software. O MD5 é completamente inapropriado para uso em sistemas de segurança (como armazenamento de senhas ou validação de integridade).",
    recommendation: "**Solução:** Utilize `hashlib` com `sha256` ou `sha512`.\n\n❌ **Código Inseguro (Evite):**\n```python\nimport hashlib\nhashed = hashlib.md5(data.encode()).hexdigest()\n```\n\n✅ **Código Seguro:**\n```python\nimport hashlib\nhashed = hashlib.sha256(data.encode()).hexdigest()\n```"
  },

  // ===========================
  // 🛡️ CORS & MISCONFIGURATION
  // ===========================
  "CORS Permissivo (Wildcard)": {
    description: "A política CORS (Cross-Origin Resource Sharing) configurada com curinga (`*`) permite que qualquer domínio externo faça requisições à sua API. Em ambientes corporativos, isso é uma falha grave de segurança, pois pode expor endpoints internos a sites maliciosos.",
    recommendation: "**Solução:** Restrinja o cabeçalho `Access-Control-Allow-Origin` a uma lista de domínios específicos da sua organização ou, se a API for pública, utilize um mecanismo de autenticação para restringir o acesso.\n\n❌ **Configuração Insegura:**\n```text\nAccess-Control-Allow-Origin: *\n```\n\n✅ **Configuração Segura:**\n```text\nAccess-Control-Allow-Origin: https://app.sefaz.ba.gov.br\n```"
  },
  "CORS Permissivo (.NET)": {
    description: "Configurações de CORS excessivamente permissivas utilizando `.AllowAnyOrigin()`, `.AllowAnyMethod()` ou `.AllowAnyHeader()` em aplicações .NET eliminam todas as restrições de segurança de origem, expondo seus endpoints a ataques CSRF e vazamento de dados.",
    recommendation: "**Solução:** Utilize `.WithOrigins()` e `.WithMethods()` para definir explicitamente as origens e métodos HTTP permitidos.\n\n❌ **Código Inseguro (Evite):**\n```csharp\napp.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod());\n```\n\n✅ **Código Seguro:**\n```csharp\napp.UseCors(policy => policy.WithOrigins(\"https://app.sefaz.ba.gov.br\"));\n```"
  },
  "Debug Mode Ativo (web.config)": {
    description: "O parâmetro `debug=\"true\"` no `web.config` ou `appsettings.json` de uma aplicação ASP.NET faz com que o servidor forneça informações detalhadas de erro, pilhas e caminhos de arquivos quando uma exceção ocorre. Um atacante pode explorar essas informações para mapear a estrutura da aplicação.",
    recommendation: "**Solução:** Sempre defina `debug=\"false\"` ou `ASPNETCORE_ENVIRONMENT=Production` para produção. Nunca implante builds de debug em servidores expostos à internet.\n\n❌ **Configuração Insegura (Evite):**\n```xml\n<compilation debug=\"true\" />\n```\n\n✅ **Configuração Segura:**\n```xml\n<compilation debug=\"false\" />\n```"
  },
  "Debug Mode Ativo (Python)": {
    description: "Quando `DEBUG = True` em frameworks Python como Django, o sistema exibe detalhes de erros e configurações de ambiente no navegador. Isso é extremamente perigoso, pois pode expor a senha do banco de dados e outros segredos.",
    recommendation: "**Solução:** Defina `DEBUG = False` em ambiente de produção e utilize servidores WSGI/ASGI (como Gunicorn e Nginx) que não exibem rastreamentos de erro.\n\n❌ **Configuração Insegura (Evite):**\n```python\nDEBUG = True\n```\n\n✅ **Configuração Segura:**\n```python\nDEBUG = False\n```"
  },
  "Spring Boot Actuator Exposto": {
    description: "A exposição dos endpoints do Spring Boot Actuator sem autenticação é uma vulnerabilidade de configuração. Esses endpoints podem revelar informações sensíveis sobre o estado da aplicação, métricas, propriedades de ambiente e até detalhes de saúde do sistema.",
    recommendation: "**Solução:** Restrinja a exposição dos endpoints ou implemente autenticação nos mesmos. A propriedade `management.endpoints.web.exposure.include` deve ser configurada com cuidado.\n\n❌ **Configuração Insegura (Evite):**\n```properties\nmanagement.endpoints.web.exposure.include=*\n```\n\n✅ **Configuração Segura:**\n```properties\nmanagement.endpoints.web.exposure.include=health,info\nmanagement.endpoint.health.show-details=never\n```"
  },
  "CSRF Protection Desativado (.NET)": {
    description: "A desativação da proteção contra CSRF (Cross-Site Request Forgery) em endpoints que alteram dados críticos é uma falha grave de controle de acesso. Um atacante pode induzir um usuário autenticado a realizar ações não desejadas, como criar ou excluir registros, sem o seu consentimento.",
    recommendation: "**Solução:** Certifique-se de que a proteção CSRF está ativa no middleware. Em ASP.NET Core, ela é habilitada por padrão, mas você deve evitar desabilitá-la com atributos como `[IgnoreAntiforgeryToken]` em ações que manipulam dados.\n\n❌ **Código Inseguro (Evite):**\n```csharp\n[HttpPost]\n[IgnoreAntiforgeryToken]\npublic IActionResult Delete(int id) { ... }\n```\n\n✅ **Código Seguro:**\n```csharp\n[HttpPost]\n[ValidateAntiForgeryToken]\npublic IActionResult Delete(int id) { ... }\n```"
  },
  "SSL/TLS Validation Disabled (.NET)": {
    description: "Desabilitar a validação do certificado SSL/TLS em clientes HTTP é uma prática extremamente insegura. Isso deixa a aplicação vulnerável a ataques do tipo Man-in-the-Middle (MITM), onde um atacante pode interceptar e modificar dados transmitidos.",
    recommendation: "**Solução:** Nunca desabilite a validação de certificados no código cliente. Se você estiver usando um proxy corporativo, configure-o corretamente nos arquivos de configuração, não através de código.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nServicePointManager.ServerCertificateValidationCallback = delegate { return true; };\n```\n\n✅ **Código Seguro:**\n```csharp\n// Remova qualquer código que valide o certificado. A validação padrão do .NET é a mais segura.\n```"
  },
  "SSL/TLS Validation Disabled (Node.js)": {
    description: "Em Node.js, configurar `rejectUnauthorized: false` nas requisições HTTPS expõe a aplicação a ataques MITM. Isso desabilita a verificação da cadeia de certificados do servidor remoto.",
    recommendation: "**Solução:** Remova completamente essa configuração, ou mantenha `rejectUnauthorized: true` (o padrão). Se precisar usar certificados autoassinados, adicione-os ao seu repositório de certificados confiáveis, não desative a verificação.\n\n❌ **Código Inseguro (Evite):**\n```javascript\nconst https = require('https');\nconst options = { rejectUnauthorized: false };\nhttps.get(url, options, (res) => { ... });\n```\n\n✅ **Código Seguro:**\n```javascript\nconst https = require('https');\nhttps.get(url, (res) => { ... }); // A validação padrão é segura.\n```"
  },

  // ===========================
  // 🛡️ CROSS-SITE SCRIPTING (XSS)
  // ===========================
  "DOM-based XSS (innerHTML)": {
    description: "A propriedade `innerHTML` em JavaScript permite a injeção de HTML arbitrário em uma página. Se um valor não sanitizado vindo do usuário for atribuído a `innerHTML`, um atacante pode injetar scripts maliciosos, resultando em **XSS**. Um atacante pode roubar cookies e sessões de usuários.",
    recommendation: "**Solução:** Prefira o uso de `textContent` ou `innerText`, que tratam o conteúdo como texto puro e não executam scripts. Se você realmente precisar de HTML dinâmico, utilize bibliotecas de sanitização como `DOMPurify`.\n\n❌ **Código Inseguro (Evite):**\n```javascript\nelement.innerHTML = userInput;\n```\n\n✅ **Código Seguro:**\n```javascript\nelement.textContent = userInput;\n```\n\n✅ **Código Seguro (se precisar de HTML):**\n```javascript\nimport DOMPurify from 'dompurify';\nelement.innerHTML = DOMPurify.sanitize(userInput);\n```"
  },
  "DOM-based XSS (document.write)": {
    description: "O método `document.write()` é outra prática perigosa que pode levar a **XSS** DOM-based. Ele insere dinamicamente conteúdo na página, e se os dados inseridos forem controlados pelo usuário, scripts maliciosos podem ser executados.",
    recommendation: "**Solução:** Evite `document.write()` completamente em favor de manipulação de DOM com `textContent` ou API de template modernas como React's JSX.\n\n❌ **Código Inseguro (Evite):**\n```javascript\ndocument.write('<div>' + userInput + '</div>');\n```\n\n✅ **Código Seguro:**\n```javascript\nconst div = document.createElement('div');\ndiv.textContent = userInput;\ndocument.body.appendChild(div);\n```"
  },
  "XSS (Html.Raw) - ASP.NET MVC": {
    description: "O método `Html.Raw()` no ASP.NET MVC renderiza o conteúdo HTML sem escapar os caracteres especiais. Se esse conteúdo for proveniente de uma fonte controlada pelo usuário, isso permite a injeção de **Cross-Site Scripting (XSS)**.",
    recommendation: "**Solução:** Evite `Html.Raw()`. Utilize a codificação padrão do Razor (`@`), que automaticamente escapa os caracteres. Se precisar de conteúdo HTML rico, utilize uma biblioteca de sanitização de HTML (como o HtmlSanitizer) antes de renderizar.\n\n❌ **Código Inseguro (Evite):**\n```csharp\n@Html.Raw(Model.Conteudo)\n```\n\n✅ **Código Seguro:**\n```csharp\n@Model.Conteudo  // O Razor escapa automaticamente.\n```"
  },
  "XSS (dangerouslySetInnerHTML) - React": {
    description: "O React fornece a prop `dangerouslySetInnerHTML` para renderizar HTML bruto. Se dados de usuário forem passados para esta prop sem sanitização, a aplicação fica vulnerável a **Cross-Site Scripting (XSS)**.",
    recommendation: "**Solução:** Evite `dangerouslySetInnerHTML` sempre que possível. Se for absolutamente necessário, certifique-se de que o conteúdo seja sanitizado (por exemplo, usando `DOMPurify`) antes de ser renderizado.\n\n❌ **Código Inseguro (Evite):**\n```jsx\n<div dangerouslySetInnerHTML={{ __html: userContent }} />\n```\n\n✅ **Código Seguro:**\n```jsx\nimport DOMPurify from 'dompurify';\n<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />\n```"
  },

  // ===========================
  // 🛡️ INSECURE DESERIALIZATION
  // ===========================
  "Insecure Deserialization - .NET (BinaryFormatter)": {
    description: "A deserialização insegura em .NET utilizando `BinaryFormatter.Deserialize` ou `NetDataContractSerializer` é uma vulnerabilidade crítica. Atacantes podem manipular o payload serializado para executar código arbitrário no servidor (RCE).",
    recommendation: "**Solução:** Evite `BinaryFormatter`. Prefira formatos de serialização seguros, como JSON ou XML, e nunca serialize objetos não confiáveis. Desabilite explicitamente o `TypeNameHandling.All` em JSON.NET.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nvar formatter = new BinaryFormatter();\nvar obj = (MyClass)formatter.Deserialize(stream);\n```\n\n✅ **Código Seguro:**\n```csharp\n// Utilize System.Text.Json ou Newtonsoft.Json com TypeNameHandling.None\nvar obj = JsonSerializer.Deserialize<MyClass>(jsonString);\n```"
  },
  "Insecure Deserialization - Java (ObjectInputStream)": {
    description: "Em Java, a deserialização utilizando `ObjectInputStream.readObject()` pode ser explorada para executar código remoto (RCE) se a cadeia de classes serializadas contiver gadgets (classes com comportamento malicioso).",
    recommendation: "**Solução:** Evite a serialização nativa do Java. Utilize formatos de serialização padrão como JSON ou XML (Jackson, GSON) com validação rigorosa de tipos.\n\n❌ **Código Inseguro (Evite):**\n```java\nObjectInputStream ois = new ObjectInputStream(new FileInputStream(\"data.ser\"));\nObject obj = ois.readObject();\n```\n\n✅ **Código Seguro:**\n```java\nObjectMapper mapper = new ObjectMapper();\nMyClass obj = mapper.readValue(data, MyClass.class);\n```"
  },
  "Insecure Deserialization - Python (pickle)": {
    description: "O módulo `pickle` do Python é considerado extremamente inseguro para carregar dados de fontes não confiáveis, pois pode executar código arbitrário ao ser desserializado. Isso pode levar à execução remota de código (RCE).",
    recommendation: "**Solução:** Use formatos de serialização seguros como JSON ou YAML com `SafeLoader`.\n\n❌ **Código Inseguro (Evite):**\n```python\nimport pickle\nobj = pickle.loads(data)\n```\n\n✅ **Código Seguro:**\n```python\nimport json\nobj = json.loads(data)\n```"
  },
  "Insecure Deserialization - Python (yaml.load)": {
    description: "Em Python, o uso de `yaml.load()` sem o parâmetro `SafeLoader` é uma vulnerabilidade de deserialização insegura. O YAML pode conter tags de execução de código, permitindo a injeção de comandos.",
    recommendation: "**Solução:** Sempre utilize `yaml.safe_load()` ao invés de `yaml.load()` para evitar a execução de código arbitrário.\n\n❌ **Código Inseguro (Evite):**\n```python\nimport yaml\ndata = yaml.load(user_input)\n```\n\n✅ **Código Seguro:**\n```python\nimport yaml\ndata = yaml.safe_load(user_input)\n```"
  },
  "Insecure Deserialization - PHP (unserialize)": {
    description: "Em PHP, a função `unserialize()` é uma grande causa de vulnerabilidades de RCE. O PHP permite a definição de funções mágicas como `__wakeup()` e `__destruct()`, que podem ser exploradas para executar código malicioso.",
    recommendation: "**Solução:** Sempre prefira formatos de serialização seguros como JSON (`json_encode`/`json_decode`). Evite `unserialize()` de entradas de usuário.\n\n❌ **Código Inseguro (Evite):**\n```php\n$data = unserialize($user_input);\n```\n\n✅ **Código Seguro:**\n```php\n$data = json_decode($user_input, true);\n```"
  },

  // ===========================
  // 🛡️ SSRF, PATH TRAVERSAL & BROKEN ACCESS
  // ===========================
  "SSRF - C# (HttpClient sem BaseAddress)": {
    description: "O uso de `HttpClient` para fazer requisições a URLs dinâmicas (como `http://<host>`) sem uma base URL pré-definida é um vetor clássico de **Server-Side Request Forgery (SSRF)**. Um atacante pode usar a aplicação para fazer requisições a serviços internos da rede que deveriam estar bloqueados.",
    recommendation: "**Solução:** Sempre utilize a propriedade `BaseAddress` do `HttpClient` para definir a URL base. Nunca permita que o usuário controle o host ou o path da URL de forma irrestrita. Implemente uma lista de domínios permitidos (AllowList).\n\n❌ **Código Inseguro (Evite):**\n```csharp\nusing (var client = new HttpClient()) {\n    var response = await client.GetAsync(\"http://\" + host + \"/admin\");\n}\n```\n\n✅ **Código Seguro:**\n```csharp\nvar client = new HttpClient();\nclient.BaseAddress = new Uri(\"https://api.trusted.com/\");\n```"
  },
  "SSRF - Python (requests.get com entrada do usuário)": {
    description: "Em Python, fazer `requests.get()` com uma URL fornecida pelo usuário é um sinal de **SSRF**. Um atacante pode acessar endereços IP internos, serviços locais, ou URLs de metadados da cloud, vazando informações sensíveis.",
    recommendation: "**Solução:** Restrinja as URLs a um domínio específico (AllowList). Valide se a URL começa com um domínio confiável antes de fazer a requisição.\n\n❌ **Código Inseguro (Evite):**\n```python\nresponse = requests.get(request.args.get('url'))\n```\n\n✅ **Código Seguro:**\n```python\nif request.args.get('url').startswith('https://api.trusted.com/'):\n    response = requests.get(request.args.get('url'))\n```"
  },
  "SSRF - PHP (file_get_contents com $_GET)": {
    description: "Em PHP, `file_get_contents($_GET['url'])` é extremamente perigoso, pois pode ler arquivos locais (`file:///etc/passwd`) ou fazer requisições internas, caracterizando **SSRF** e **Path Traversal** simultaneamente.",
    recommendation: "**Solução:** Utilize uma biblioteca de validação de URL que verifique o esquema da URL e um AllowList de domínios.\n\n❌ **Código Inseguro (Evite):**\n```php\n$content = file_get_contents($_GET['url']);\n```\n\n✅ **Código Seguro:**\n```php\nif (filter_var($_GET['url'], FILTER_VALIDATE_URL) && parse_url($_GET['url'], PHP_URL_HOST) === 'api.trusted.com') {\n    $content = file_get_contents($_GET['url']);\n}\n```"
  },
  "Path Traversal - C# (File.ReadAllText com input do usuário)": {
    description: "A leitura de arquivos utilizando `File.ReadAllText()` com caminhos fornecidos pelo usuário, sem validação, permite **Path Traversal** (Directory Traversal). Um atacante pode usar `../` para sair do diretório da aplicação e ler qualquer arquivo do sistema.",
    recommendation: "**Solução:** Valide o caminho com `Path.GetFullPath` e garanta que ele esteja dentro do diretório base esperado. Nunca confie diretamente em entradas do usuário para caminhos de arquivos.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nvar text = File.ReadAllText(filePath);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar rootDir = Path.GetFullPath(\"data\");\nvar fullPath = Path.GetFullPath(Path.Combine(rootDir, filePath));\nif (!fullPath.StartsWith(rootDir)) { throw new UnauthorizedAccessException(); }\n```"
  },
  "Path Traversal - Java (new File com request.getParameter)": {
    description: "Em Java, a criação de um objeto `File` a partir de um parâmetro `request.getParameter()` é um vetor conhecido para **Path Traversal**. Se um atacante enviar uma string com `../`, ele pode sair da pasta esperada e acessar diretórios do sistema.",
    recommendation: "**Solução:** Sanitize o caminho, garanta que ele esteja dentro de um diretório confinado (`/app/uploads`) e não permita caracteres como `../`.\n\n❌ **Código Inseguro (Evite):**\n```java\nFile file = new File(request.getParameter(\"file\"));\n```\n\n✅ **Código Seguro:**\n```java\nString fileName = request.getParameter(\"file\");\nPath root = Paths.get(\"/app/uploads\");\nPath path = root.resolve(fileName).normalize();\nif (!path.startsWith(root)) { throw new SecurityException(); }\n```"
  },
  "Path Traversal (Relative Path) - Busca Geral": {
    description: "A presença de caminhos relativos como `../` ou `..\\` no código-fonte pode ser um indicativo de vulnerabilidade de **Path Traversal** se esses caminhos forem combinados com APIs de leitura de arquivos com entradas do usuário.",
    recommendation: "**Solução:** A melhor defesa contra Path Traversal é normalizar o caminho e verificar se ele está realmente dentro da pasta raiz pretendida antes de realizar a operação de IO.\n\n✅ **Exemplo Genérico Seguro:**\n```csharp\nstring baseDir = Path.GetFullPath(\"uploads\");\nstring safePath = Path.GetFullPath(Path.Combine(baseDir, fileName));\nif (!safePath.StartsWith(baseDir)) throw new Exception(\"Path traversal detected!\");\n```"
  },
  "Backdoor / Hardcoded Admin Credentials": {
    description: "Credenciais de backdoor (como `test_password`, `bypass_auth`, `debug_admin`) ou senhas de teste hardcoded no código representam uma ameaça de segurança crítica. Elas podem ser usadas por atacantes para obter acesso irrestrito à aplicação ou ao banco de dados.",
    recommendation: "**Solução:** Utilize práticas de CI/CD para escanear credenciais no código (como GitLeaks). Nunca comite senhas, mesmo que de teste. Utilize variáveis de ambiente ou serviços de gerenciamento de segredos para carregar credenciais apenas no ambiente de execução."
  },
  "AllowAnonymous em Controllers (C#)": {
    description: "O atributo `[AllowAnonymous]` em controllers .NET desativa todas as verificações de autenticação para a rota. Embora seja útil para rotas públicas (como páginas de login ou health checks), deve ser usado com extrema cautela. Se aplicado a uma rota que retorna dados sensíveis, isso representa uma falha grave de **Broken Access Control**.",
    recommendation: "**Solução:** Revise cuidadosamente todas as rotas com `[AllowAnonymous]`. Certifique-se de que a rota não retorna dados sensíveis (dados de usuários, informações fiscais, etc.). Para APIs internas, o padrão deve ser sempre autenticado, usando `[Authorize]`.\n\n✅ **Prática Segura:**\n```csharp\n[AllowAnonymous]\n[HttpGet(\"health\")]\npublic IActionResult HealthCheck() { return Ok(); }\n```"
  }
};

async function seedPatterns() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  let updatedCount = 0;
  for (const [name, data] of Object.entries(patternsData)) {
    const result = await VulnerabilityPattern.updateOne(
      { name },
      { $set: { description: data.description, recommendation: data.recommendation } }
    );
    if (result.matchedCount > 0) {
      updatedCount++;
      console.log(`✅ Padrão atualizado: "${name}"`);
    } else {
      console.log(`⚠️ Padrão não encontrado no banco: "${name}"`);
    }
  }

  console.log(`\n🎉 Seed finalizado! ${updatedCount} padrões atualizados.`);
}

seedPatterns().catch(console.error);