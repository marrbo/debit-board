// scripts/init-mongo.js
db = db.getSiblingDB('sast_platform');

// 1. Criar o Tenant Padrão (GLOBAL)
db.tenants.insertOne({
  _id: "tenant_global",
  name: "Global Organization",
  createdAt: new Date()
});

// 2. Inserir Padrões de Vulnerabilidade
db.vulnerabilitypatterns.insertMany([
  {
    name: "AllowAnonymous em Controllers",
    queryPattern: "ext:cs AllowAnonymous",
    severity: "high",
    category: "Autenticação",
    description: "Endpoint público sem autenticação",
    enabled: true,
    tenantId: "tenant_global"
  },
  {
    name: "SQL Injection com concatenação",
    queryPattern: "ext:cs \"+ \" OR \"+ \"",
    severity: "critical",
    category: "Injeção SQL",
    description: "Concatenação de strings em consultas SQL",
    enabled: true,
    tenantId: "tenant_global"
  },
  {
    name: "Hardcoded Secrets",
    queryPattern: "ext:cs \"password\" OR \"apikey\" OR \"secret\"",
    severity: "critical",
    category: "Segredos",
    description: "Senhas ou chaves de API hardcoded",
    enabled: true,
    tenantId: "tenant_global"
  }
]);