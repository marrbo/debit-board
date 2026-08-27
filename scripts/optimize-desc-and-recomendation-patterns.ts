import { connectToDatabase } from '@/lib/mongodb';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

// Os 35 padrões restantes revisados e formatados
const optimizedPatterns = [
  {
    id: "6a823f5a830f2c1c30408d4a",
    description: "O uso de `String.Format` para construir consultas SQL em **C#** é uma prática perigosa que atua de forma similar à concatenação. Se dados do usuário forem formatados diretamente na string, a aplicação fica vulnerável a **SQL Injection**.",
    recommendation: "**Solução:** Substitua `String.Format` por consultas parametrizadas, garantindo que os dados do usuário sejam tratados como parâmetros, não como parte do comando SQL.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nstring sql = String.Format(\"SELECT * FROM Logs WHERE Data = '{0}'\", dataEntrada);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar sql = \"SELECT * FROM Logs WHERE Data = @Data\";\ncmd.Parameters.AddWithValue(\"@Data\", dataEntrada);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d4c",
    description: "A utilização de `Process.Start()` em **C#** com argumentos não sanitizados permite a ocorrência de **Command Injection**. Invasores podem injetar metacaracteres de terminal para executar comandos arbitrários no sistema operacional.",
    recommendation: "**Solução:** Evite passar strings completas para invocar shells (`cmd.exe` ou `bash`). Utilize instâncias de `ProcessStartInfo` passando os argumentos em coleções isoladas do comando principal.\n\n❌ **Código Inseguro (Evite):**\n```csharp\nProcess.Start(\"cmd.exe\", \"/c \" + comandoUsuario);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar process = new Process();\nprocess.StartInfo.FileName = \"ping\";\nprocess.StartInfo.ArgumentList.Add(\"-c\");\nprocess.StartInfo.ArgumentList.Add(\"4\");\nprocess.StartInfo.ArgumentList.Add(\"8.8.8.8\"); // Dado tratado de forma segura\nprocess.Start();\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d4d",
    description: "Em **Java**, invocar o sistema operacional com `Runtime.getRuntime().exec()` interpolando entradas do usuário gera uma vulnerabilidade crítica de **Command Injection**.",
    recommendation: "**Solução:** Utilize a classe `ProcessBuilder`, que aceita comandos e argumentos como uma lista (varargs ou `List<String>`), o que impede a injeção via metacaracteres no shell.\n\n❌ **Código Inseguro (Evite):**\n```java\nRuntime.getRuntime().exec(\"ls -l \" + diretorio);\n```\n\n✅ **Código Seguro:**\n```java\nProcessBuilder pb = new ProcessBuilder(\"ls\", \"-l\", diretorio);\npb.start();\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d4e",
    description: "A execução de comandos shell através das bibliotecas nativas do **Python** (`os.system`, `subprocess.call` ou `subprocess.Popen`) utilizando concatenação possibilita ataques de **Command Injection**.",
    recommendation: "**Solução:** Utilize `subprocess.run()` repassando argumentos como uma lista e garantindo que o parâmetro `shell=False` seja mantido.\n\n❌ **Código Inseguro (Evite):**\n```python\nimport os\nos.system(\"rm -rf \" + userInput)\n```\n\n✅ **Código Seguro:**\n```python\nimport subprocess\nsubprocess.run([\"rm\", \"-rf\", userInput], shell=False)\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d51",
    description: "Chaves de API ou *tokens* gravados diretamente no código-fonte (**Hardcoded API Key**) abrem brechas gravíssimas caso o repositório seja acessado indevidamente. Invasores podem assumir identidades, gastar quotas de serviços ou extrair dados sigilosos.",
    recommendation: "**Solução:** Consuma chaves através de variáveis de ambiente. Utilize provedores de segredos na nuvem para injeção segura durante o _deploy_.\n\n❌ **Código Inseguro:**\n```javascript\nconst stripeApiKey = \"sk-live-1234567890abcdef\";\n```\n\n✅ **Código Seguro:**\n```javascript\nconst stripeApiKey = process.env.STRIPE_API_KEY;\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d52",
    description: "Armazenar a senha do banco de dados exposta na *Connection String* dentro de arquivos de configuração, como `appsettings.json` ou `web.config`, facilita o vazamento das credenciais de banco.",
    recommendation: "**Solução:** Utilize o gerenciador de *User Secrets* em desenvolvimento. Em produção, substitua a configuração sensível por variáveis de ambiente ou utilize cofres (Azure Key Vault, AWS Secrets).\n\n✅ **Configuração Segura (`appsettings.json`):**\n```json\n{\n  \"ConnectionStrings\": {\n    // A senha real NUNCA deve estar neste arquivo\n    \"DefaultConnection\": \"Server=meuservidor;Database=db;User Id=app_user;Password={INJETADO_VIA_ENV};\"\n  }\n}\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d53",
    description: "A presença de *Tokens* JWT literais (ex: `Bearer eyJ...`) espalhados no código-fonte é um lapso crítico. Esses *tokens* não expiram no controle de versão e concedem acessos permanentes e indevidos.",
    recommendation: "**Solução:** Os *tokens* devem ser gerados sob demanda via fluxos de autenticação (ex: OAuth2) ou resgatados de cofres de senhas/variáveis de ambiente, com expiração adequada.\n\n❌ **Código Inseguro:**\n```python\nheaders = { \"Authorization\": \"Bearer eyJhbGci...\" }\n```\n\n✅ **Código Seguro:**\n```python\nimport os\nheaders = { \"Authorization\": f\"Bearer {os.getenv('API_BEARER_TOKEN')}\" }\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d54",
    description: "Chaves privadas (`BEGIN RSA PRIVATE KEY`) em texto claro no código destroem a criptografia assimétrica do sistema. Atacantes podem quebrar assinaturas digitais, interceptar TLS ou forjar autenticações.",
    recommendation: "**Solução:** Implante soluções de gerenciamento de chaves como o Azure Key Vault, AWS KMS ou HashiCorp Vault. Recupere a chave assinada por identificação, não por valor absoluto.\n\n❌ **Código Inseguro:**\n```text\n-----BEGIN RSA PRIVATE KEY-----\nMIIJKQIBAAKCAgE...\n```\n\n✅ **Código Seguro (Exemplo Azure):**\n```csharp\nvar key = await keyVaultClient.GetSecretAsync(\"[https://myvault.vault.azure.net/secrets/MyPrivateKey](https://myvault.vault.azure.net/secrets/MyPrivateKey)\");\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d55",
    description: "O uso da classe `MD5.Create()` em **C#** aplica um algoritmo de *hashing* fraco, obsoleto e comprovadamente vulnerável a ataques de colisão. Isso anula a eficácia da integridade e proteção de dados.",
    recommendation: "**Solução:** Migre imediatamente para algoritmos robustos da família SHA-2 ou SHA-3. Para senhas, utilize derivações de chave (Argon2, PBKDF2 ou BCrypt).\n\n❌ **Código Inseguro:**\n```csharp\nvar hash = MD5.Create().ComputeHash(Encoding.UTF8.GetBytes(dado));\n```\n\n✅ **Código Seguro:**\n```csharp\nvar hash = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(dado));\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d56",
    description: "O `SHA1.Create()` no **C#** expõe dados a algoritmos de assinatura e verificação obsoletos. Colisões de SHA-1 já são factíveis, quebrando certificados e validações sistêmicas.",
    recommendation: "**Solução:** Implemente sempre o `SHA256` ou `SHA512`. Nunca use `SHA1` para assinaturas, proteção de arquivos ou criação de tokens em código novo.\n\n❌ **Código Inseguro:**\n```csharp\nvar hash = SHA1.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```\n\n✅ **Código Seguro:**\n```csharp\nvar hash = SHA512.Create().ComputeHash(Encoding.UTF8.GetBytes(senha));\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d57",
    description: "A utilização do `DESCryptoServiceProvider` no ecossistema **C#** sinaliza o uso do Data Encryption Standard (DES), uma cifra simétrica amplamente derrotada por hardware moderno via força bruta.",
    recommendation: "**Solução:** Troque o algoritmo DES pelo `Aes` (Advanced Encryption Standard) configurando chaves de 256 bits com modos de operação seguros (como GCM ou CBC com HMAC).\n\n❌ **Código Inseguro:**\n```csharp\nvar des = DESCryptoServiceProvider.Create();\n```\n\n✅ **Código Seguro:**\n```csharp\nusing (var aes = Aes.Create())\n{\n    aes.KeySize = 256;\n    // Lógica de encriptação...\n}\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d58",
    description: "A invocação de `MessageDigest.getInstance(\"MD5\")` ou `\"SHA-1\"` em **Java** propaga criptografia fraca em aplicações corporativas. Esses hashes falham em garantir integridade ante ataques modernos de colisão.",
    recommendation: "**Solução:** Utilize implementações recomendadas como `SHA-256` ou `SHA-512`. Para *hashing* seguro de senhas, prefira bibliotecas de BCrypt/Argon2.\n\n❌ **Código Inseguro:**\n```java\nMessageDigest md = MessageDigest.getInstance(\"MD5\");\n```\n\n✅ **Código Seguro:**\n```java\nMessageDigest md = MessageDigest.getInstance(\"SHA-256\");\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d59",
    description: "Em bibliotecas **Python**, o método `hashlib.md5()` denuncia o uso de um padrão repudiado. Ele expõe a verificação de arquivos ou persistência de senhas a vulnerabilidades graves de integridade.",
    recommendation: "**Solução:** Faça o *upgrade* da assinatura invocando `hashlib.sha256()`.\n\n❌ **Código Inseguro:**\n```python\nimport hashlib\nhashed = hashlib.md5(data.encode()).hexdigest()\n```\n\n✅ **Código Seguro:**\n```python\nimport hashlib\nhashed = hashlib.sha256(data.encode()).hexdigest()\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d5a",
    description: "Retornar o cabeçalho `Access-Control-Allow-Origin: *` de forma sistêmica desativa as proteções de CORS dos navegadores. O wildcard permite que páginas ilícitas leiam respostas e explorem a API sem impedimentos trans-origem.",
    recommendation: "**Solução:** Especifique unicamente os domínios corporativos requeridos no escopo da aplicação.\n\n❌ **Configuração Insegura:**\n```text\nAccess-Control-Allow-Origin: *\n```\n\n✅ **Configuração Segura:**\n```text\nAccess-Control-Allow-Origin: [https://meusistema.empresa.com](https://meusistema.empresa.com)\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d5c",
    description: "Ativar `debug=\"true\"` no arquivo `web.config` de aplicações .NET Framework permite o vazamento de *stack traces*, rotas físicas de servidor e variáveis ambientais sensíveis aos usuários (ou invasores).",
    recommendation: "**Solução:** Assegure-se de que a *flag* de debug esteja permanentemente desativada para os ambientes de Produção e Homologação.\n\n❌ **Configuração Insegura:**\n```xml\n<compilation debug=\"true\" targetFramework=\"4.8\" />\n```\n\n✅ **Configuração Segura:**\n```xml\n<compilation debug=\"false\" targetFramework=\"4.8\" />\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d5d",
    description: "Subir para produção *frameworks* **Python** (como Django ou Flask) com `DEBUG = True` exibe páginas de depuração ricas que costumam vazar credenciais, variáveis de ambiente, estruturas de banco de dados e paths absolutos.",
    recommendation: "**Solução:** Vincule a variável de ambiente à propriedade. Em produção, exiba apenas páginas de erro genéricas tratadas e registre exceções via *loggers* assíncronos (Sentry/Logstash).\n\n❌ **Configuração Insegura:**\n```python\nDEBUG = True\n```\n\n✅ **Configuração Segura:**\n```python\nDEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d5e",
    description: "A propriedade `management.endpoints.web.exposure.include=*` em sistemas **Spring Boot** expõe *endpoints* críticos do Actuator sem validação. O `/env` e o `/heapdump` revelam segredos profundos da aplicação na infraestrutura.",
    recommendation: "**Solução:** Reduza drasticamente a exposição. Libere estritamente as rotas de saúde `/health` e `/info` sem expor detalhes, e proteja outros *endpoints* com o Spring Security.\n\n❌ **Configuração Insegura:**\n```properties\nmanagement.endpoints.web.exposure.include=*\n```\n\n✅ **Configuração Segura:**\n```properties\nmanagement.endpoints.web.exposure.include=health,info\nmanagement.endpoint.health.show-details=never\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d5f",
    description: "Inutilizar de maneira intencional as validações de _Anti-forgery Tokens_ (usando `[IgnoreAntiforgeryToken]`) no **ASP.NET** permite ataques diretos de **CSRF**. Um invasor poderá submeter formulários falsificados pela sessão do usuário ativo.",
    recommendation: "**Solução:** Valide os _tokens_ com `[ValidateAntiForgeryToken]` em absolutamente todas as rotas POST, PUT, DELETE, impedindo ataques trans-site.\n\n❌ **Código Inseguro:**\n```csharp\n[HttpPost]\n[IgnoreAntiforgeryToken]\npublic IActionResult ExcluirRegistro(int id) { ... }\n```\n\n✅ **Código Seguro:**\n```csharp\n[HttpPost]\n[ValidateAntiForgeryToken]\npublic IActionResult ExcluirRegistro(int id) { ... }\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d60",
    description: "A definição de `ServerCertificateValidationCallback` para `return true;` em **C#** silencia os alertas nativos do protocolo TLS/SSL. A aplicação aprovará certificados inválidos, expirados ou forjados, propiciando ataques Man-in-the-Middle (MITM).",
    recommendation: "**Solução:** Remova o contorno imposto ao `HttpClientHandler`. Deixe as bibliotecas criptográficas validarem a integridade e confiança da chave pública.\n\n❌ **Código Inseguro:**\n```csharp\nServicePointManager.ServerCertificateValidationCallback = (sender, cert, chain, sslPolicyErrors) => true;\n```\n\n✅ **Código Seguro:**\nRemova qualquer delegação de callback customizada e deixe o `.NET` validar automaticamente."
  },
  {
    id: "6a823f5a830f2c1c30408d61",
    description: "A diretiva `rejectUnauthorized: false` em clientes HTTP do ecossistema **Node.js** desliga as checagens criptográficas do TLS. Sem a confiança do *certificate authority*, a rota fica aberta a interceptações passivas e ativas de rede (MITM).",
    recommendation: "**Solução:** Utilize `rejectUnauthorized: true` (comportamento padrão). Caso integre com serviços internos autogerados, alimente a *store* de confiança (CA) do *agent* no lugar de desativar a regra.\n\n❌ **Código Inseguro:**\n```javascript\nconst agent = new https.Agent({ rejectUnauthorized: false });\naxios.get(url, { httpsAgent: agent });\n```\n\n✅ **Código Seguro:**\n```javascript\n// Deixe o padrão (true) ou adicione o CA raiz da sua empresa\nconst agent = new https.Agent({ ca: fs.readFileSync('corporate-ca.pem') });\naxios.get(url, { httpsAgent: agent });\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d63",
    description: "O emprego do método clássico `document.write()` concatenando conteúdo irrestrito provoca **DOM-based XSS**. Modificar o fluxo de documentos diretamente no *parsing* destrói o isolamento entre estrutura e dados (scripts arbitrários operam sob o contexto da página).",
    recommendation: "**Solução:** Suspenda a utilização do `document.write`. Migre para a criação controlada de elementos (`createElement` somado ao `textContent`).\n\n❌ **Código Inseguro:**\n```javascript\ndocument.write('<p>Busca: ' + userQuery + '</p>');\n```\n\n✅ **Código Seguro:**\n```javascript\nconst p = document.createElement('p');\np.textContent = 'Busca: ' + userQuery;\ndocument.body.appendChild(p);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d64",
    description: "A função `Html.Raw()` no **ASP.NET MVC (Razor)** contorna deliberadamente os mecanismos de higienização da _view engine_. Processar *strings* de entrada no `Html.Raw()` injeta **XSS** diretamente no HTML compilado da página.",
    recommendation: "**Solução:** Aproveite o comportamento inerente do Razor (o caractere `@`) que aplica *HTML Encode* preventivo. Quando o *parse* de marcação for estritamente necessário, faça-o mediante bibliotecas focadas como `Ganss.XSS.HtmlSanitizer`.\n\n❌ **Código Inseguro:**\n```csharp\n<div>@Html.Raw(Model.ComentarioUsuario)</div>\n```\n\n✅ **Código Seguro:**\n```csharp\n<div>@Model.ComentarioUsuario</div>\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d65",
    description: "A _prop_ `dangerouslySetInnerHTML` no **React** age perigosamente como porta de entrada a **XSS**. Sem filtragem externa, o virtual DOM despacha nós indevidos com scripts predatórios sem validação aos navegadores.",
    recommendation: "**Solução:** Remova o parâmetro em prol da renderização transpilada tradicional via chaves JSX `{}`. Caso seja inevitável exibir blocos ricos (Rich Text), utilize o `DOMPurify` para sanitizar o *payload*.\n\n❌ **Código Inseguro:**\n```jsx\n<div dangerouslySetInnerHTML={{ __html: props.textoUsuario }} />\n```\n\n✅ **Código Seguro:**\n```jsx\nimport DOMPurify from 'dompurify';\n<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(props.textoUsuario) }} />\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d66",
    description: "O uso de `BinaryFormatter` no **.NET** constitui um vetor fatal de **Insecure Deserialization**. A desserialização binária cria objetos arbitrários especificados na _payload_ e dispara destrutores/gadgets que provocam Execução Remota de Código (RCE).",
    recommendation: "**Solução:** O pacote `BinaryFormatter` é severamente obsoleto e marcado como perigoso pela própria Microsoft. Refatore para serializadores focados em dados estáticos como `System.Text.Json` ou `XmlSerializer`.\n\n❌ **Código Inseguro:**\n```csharp\nvar formatter = new BinaryFormatter();\nvar payload = formatter.Deserialize(stream);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar payload = JsonSerializer.Deserialize<MySafeModel>(jsonString);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d67",
    description: "Instanciar `ObjectInputStream.readObject()` recebendo dados manipulados no **Java** facilita execuções predatórias de código (RCE). O motor reflexivo da JVM injetará propriedades nos construtores forjados (cadeia de *Gadgets* do _ysoserial_).",
    recommendation: "**Solução:** Anule o uso de formatos nativos `.ser`. Abrace bibliotecas externas sem capacidades polimórficas (como o *Jackson Data-Bind* puro e devidamente configurado) para parse de DTOs fechados.\n\n❌ **Código Inseguro:**\n```java\nObjectInputStream in = new ObjectInputStream(request.getInputStream());\nObject payload = in.readObject();\n```\n\n✅ **Código Seguro:**\n```java\nObjectMapper mapper = new ObjectMapper();\nMyDto payload = mapper.readValue(request.getInputStream(), MyDto.class);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d68",
    description: "Consumir *strings* binárias ou dados não controlados através de `pickle.loads()` no **Python** abre vetores explícitos de RCE. A estrutura da biblioteca permite a injeção oculta da função nativa de execução de _shell_ `__reduce__` nas instâncias.",
    recommendation: "**Solução:** Migrar todo o tráfego que envolva redes ou interações com usuários não autenticados/front-end para dicionários em `json` (que previnem inferência de código dinâmico).\n\n❌ **Código Inseguro:**\n```python\nimport pickle\nuser_obj = pickle.loads(request.data)\n```\n\n✅ **Código Seguro:**\n```python\nimport json\nuser_obj = json.loads(request.data.decode('utf-8'))\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d69",
    description: "A rotina `yaml.load()` no interpretador **Python** resolve diretivas imbutidas nos nós das marcações (`!!python/object/apply`). Um invasor pode incluir comandos de RCE em arquivos aparentemente limpos de configurações.",
    recommendation: "**Solução:** Nunca faça parse dinâmico completo de arquivos YAML externos. Empregue impreterivelmente o `yaml.safe_load()`, bloqueando a reflexão agressiva de objetos subjacentes.\n\n❌ **Código Inseguro:**\n```python\nimport yaml\ndados_config = yaml.load(arquivo_usuario)\n```\n\n✅ **Código Seguro:**\n```python\nimport yaml\ndados_config = yaml.safe_load(arquivo_usuario)\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6a",
    description: "No ecossistema **PHP**, despachar entradas provenientes de POST/GET direto para o método `unserialize()` concede execuções não autorizadas da linguagem. Os métodos mágicos (`__wakeup`, `__destruct`) agem como ponte para execução de ataques complexos de **RCE**.",
    recommendation: "**Solução:** Adote transferências agnósticas (JSON). A API `json_decode` lê pares de chaves limpas anulando completamente o polimorfismo das classes nativas.\n\n❌ **Código Inseguro:**\n```php\n$obj = unserialize($_COOKIE['session_data']);\n```\n\n✅ **Código Seguro:**\n```php\n$obj = json_decode($_COOKIE['session_data'], true);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6b",
    description: "Empregar rotas inteiras criadas na *Request URI* no framework `HttpClient` em **C#** materializa falhas de **SSRF**. Invasores mascaram chamadas arbitrárias induzindo a nuvem a varrer ou atacar a rede privada (VPC/metadados do provedor).",
    recommendation: "**Solução:** Fixe as âncoras da comunicação parametrizando a `BaseAddress` com origens chumbadas pelo back-end (Lista de Permissão rigorosa). Refine as chamadas anexando somente *paths* ou *querystrings* restritos.\n\n❌ **Código Inseguro:**\n```csharp\nusing (var client = new HttpClient()) {\n    var res = await client.GetAsync(request.UrlDestino);\n}\n```\n\n✅ **Código Seguro:**\n```csharp\n// Somente rotas conhecidas no domínio fixo\nvar client = new HttpClient { BaseAddress = new Uri(\"[https://api.parceira.com/](https://api.parceira.com/)\") };\nvar res = await client.GetAsync($\"/recurso/{request.Id}\");\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6c",
    description: "Passar URLs recebidas externamente (via `request.args` ou `form`) para os submódulos da `requests` no **Python** causa vulnerabilidades graves de **SSRF**. O _backend_ passará a agir como um *proxy* ilícito para escaneamentos na *intranet*.",
    recommendation: "**Solução:** Sanitize as URLs baseando-se numa lista de liberação rígida (*AllowList*). Use validações sintáticas prévias (biblioteca `urllib.parse`) forçando os acessos unicamente aos domínios e protocolos estipulados.\n\n❌ **Código Inseguro:**\n```python\n# Usuário passa url=[http://169.254.169.254/latest/meta-data/](http://169.254.169.254/latest/meta-data/)\nrequests.get(request.args.get('url'))\n```\n\n✅ **Código Seguro:**\n```python\nfrom urllib.parse import urlparse\nurl_input = request.args.get('url')\nhost_permitido = 'api.confiavel.com'\n\nif urlparse(url_input).hostname == host_permitido:\n    requests.get(url_input)\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6d",
    description: "Interpolar dados colhidos do array global `$_GET` para dentro da diretiva estrutural `file_get_contents()` no **PHP** promove execuções catastróficas somando **SSRF** com o escopo massivo de **Path Traversal**. O servidor lerá ou requisitará livremente arquivos da máquina host.",
    recommendation: "**Solução:** Limite escopos e tipos. Previna injeções de protocolos como `php://`, `file://` garantindo acessos somente via identificadores brutos e seguros em infraestruturas validadas.\n\n❌ **Código Inseguro:**\n```php\n$dados = file_get_contents($_GET['imagem_url']);\n```\n\n✅ **Código Seguro:**\n```php\n$url = $_GET['imagem_url'];\nif (filter_var($url, FILTER_VALIDATE_URL) && parse_url($url, PHP_URL_HOST) === 'api.trusted.com') {\n    $dados = file_get_contents($url);\n}\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6e",
    description: "Invocar `File.ReadAllText()` no **C#** somado a nomenclaturas recuperadas do `Request` destrava vetores agressivos de **Path Traversal / Directory Traversal**. Interceptar sequências do tipo `../` retira as amarras da pasta de _uploads_ expondo o sistema inteiro.",
    recommendation: "**Solução:** Utilize classes imutáveis para abstrair raízes e normalizar *paths*. Use `Path.GetFullPath` validando obrigatoriamente se a pasta unificada inicia na base absoluta permitida do diretório restrito.\n\n❌ **Código Inseguro:**\n```csharp\nvar conteudo = File.ReadAllText(Request.Query[\"arquivo\"]);\n```\n\n✅ **Código Seguro:**\n```csharp\nvar baseDir = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), \"Uploads\"));\nvar combinedPath = Path.GetFullPath(Path.Combine(baseDir, Request.Query[\"arquivo\"]));\n\nif (!combinedPath.StartsWith(baseDir))\n    throw new UnauthorizedAccessException(\"Operação de leitura negada.\");\n\nvar conteudo = File.ReadAllText(combinedPath);\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d6f",
    description: "Produzir instâncias na classe abstrata `java.io.File` a partir de formulários/URL via `request.getParameter()` em **Java** facilita severamente o escape de pastas (**Path Traversal**). Navegando os mapeamentos (*dot-dot-slash*), os invasores roubam chaves, logs e registros de sistema.",
    recommendation: "**Solução:** Fuja de processamentos fracos com a interface antiquada `File`. Substitua imediatamente o rastreio via a classe segura `java.nio.file.Path`, utilizando regras de canonização para invalidar _escapes_ (`..`).\n\n❌ **Código Inseguro:**\n```java\nFile f = new File(\"/var/www/uploads/\" + request.getParameter(\"nomeArquivo\"));\n```\n\n✅ **Código Seguro:**\n```java\nPath raiz = Paths.get(\"/var/www/uploads\").toAbsolutePath().normalize();\nPath caminhoResolvido = raiz.resolve(request.getParameter(\"nomeArquivo\")).normalize();\n\nif (!caminhoResolvido.startsWith(raiz)) {\n    throw new SecurityException(\"Tentativa inválida de escape de diretório.\");\n}\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d70",
    description: "Localizar assinaturas de escapes sintáticos (como `../` e `..\\`) em requisições sinaliza fortes indícios de comportamentos transacionais nocivos em busca de vetores de **Path Traversal**. Atuar no impedimento é mandatório, independentemente da stack tecnológica da aplicação.",
    recommendation: "**Solução:** Normalize strings removendo caracteres nulos (`%00`) e barras invertidas mistas. A melhor tática envolve *Whitelists* restritas que aceitam apenas letras e números, desprezando simbolismos nocivos.\n\n✅ **Validação Genérica Prévia:**\n```javascript\n// Regex blindando acessos via whitelisting rigorosa em Node.js (apenas alfanuméricos e traço/underscore)\nconst isValidFilename = /^[a-zA-Z0-9_-]+\\.[a-zA-Z0-9]+$/.test(userInput);\nif (!isValidFilename) throw new Error(\"Arquivo inválido.\");\n```"
  },
  {
    id: "6a823f5a830f2c1c30408d71",
    description: "Mapear senhas, lógicas ocultas ou palavras de controle de estado (ex: `bypass_auth`, `debug_admin`) imbutidas permanentemente na base central denota presença crítica de **Backdoor e Falhas na Cadeia de Autorização**.",
    recommendation: "**Solução:** Exclua todas as ramificações de IFs ocultos nos repositórios. Limite o bypass apenas para suítes de testes segregadas ou instâncias _Mock_ locais que jamais chegam a esteiras ativas de Deploy e Produção.\n\n❌ **Código Inseguro (Evite):**\n```python\nif input_pwd == user.pwd or input_pwd == \"master_bypass_123\":\n    # Login concedido\n```\n\n✅ **Código Seguro:**\nEvitar condicionais permanentes. Todos os _Logins_ e acessos transacionais devem invocar _Providers_ de autenticação seguros sem contornos sistêmicos duros."
  }
];


async function run() {
  const client = new MongoClient(uri!);

  try {
    await connectToDatabase();

    let updatedCount = 0;

    console.log(`Iniciando a atualização de ${optimizedPatterns.length} padrões...`);

    for (const pattern of optimizedPatterns) {
      const result = await VulnerabilityPattern.updateOne(
        { _id: new mongoose.Types.ObjectId(pattern.id) },
        { 
          $set: { 
            description: pattern.description,
            recommendation: pattern.recommendation 
          } 
        }
      );

      if (result.matchedCount > 0) {
        console.log(`Padrão atualizado: ${pattern.id}`);
        updatedCount++;
      } else {
        console.warn(`⚠️ ID não encontrado no banco: ${pattern.id}`);
      }
    }

    console.log(`\n🎉 Processo concluído! ${updatedCount} padrões foram atualizados no banco de dados.`);
  } catch (error) {
    console.error('❌ Falha na execução:', error);
  } finally {
    await client.close();
  }
}

run();