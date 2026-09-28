<#--
  Debit Board — template macro
  Substitui o `template.ftl` herdado do Keycloak para reescrever a
  estrutura de layout. O `login.ftl` continua chamando esta macro via
  `<@layout.registrationLayout>` — só a árvore HTML resultante muda.

  Layout split 65/35 — espelha os componentes React do app:
    - Esquerda: painel de marketing (LoginBackground + LoginMarketing)
    - Direita: card do formulário (login.ftl)
-->
<#macro registrationLayout
    displayInfo=false
    displayMessage=true
    displayRequiredFields=true
    headerNode=""
    socialProvidersNode=""
    infoNode=""
    documentTitle=""
    bodyClassName=""
>
<!DOCTYPE html>
<html class="db-html" <#if realm.internationalizationEnabled> lang="${locale.currentLanguageTag}" dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Debit-Board · Entrar</title>
    <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/img/favicon.svg">
    <#-- Aplica o tema do app antes do CSS pintar (anti-flash).
         Lê o cookie `db_theme` gravado pelo Next.js. Setamos tanto a
         classe `.dark` quanto o atributo `data-theme` para que o
         mesmo arquivo CSS sirva app e Keycloak. -->
    <script>
    (function () {
        var theme = null;
        try {
            var m = document.cookie.match(/(?:^|;\s*)db_theme=([^;]+)/);
            if (m) {
                var v = decodeURIComponent(m[1]);
                if (v === "light" || v === "dark") theme = v;
            }
        } catch (e) {}
        if (!theme) {
            theme = (window.matchMedia &&
                     window.matchMedia("(prefers-color-scheme: dark)").matches)
                    ? "dark" : "light";
        }
        var html = document.documentElement;
        html.classList.toggle("dark", theme === "dark");
        html.setAttribute("data-theme", theme);
    })();
    </script>
    <link rel="stylesheet" href="${url.resourcesPath}/css/debit-board.css">
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
</head>
<body class="db-body">

    <!-- ============================================================
         Coluna esquerda — painel de marketing
         Espelha components/login/LoginBackground.tsx + LoginMarketing.tsx
         ============================================================ -->
    <aside class="db-aside">

        <#-- Camadas decorativas do background (LoginBackground.tsx) -->
        <div class="db-aside__layers" aria-hidden="true">
            <div class="db-layer db-layer--base"></div>
            <div class="db-layer db-layer--glow-center"></div>
            <div class="db-layer db-layer--glow-tl"></div>
            <div class="db-layer db-layer--glow-br"></div>
            <div class="db-layer db-layer--grid"></div>
            <div class="db-layer db-layer--vignette-top"></div>
            <div class="db-layer db-layer--vignette-bottom"></div>
        </div>

        <#-- Conteúdo do painel (LoginMarketing.tsx) -->
        <div class="db-aside__content">

            <#-- Identidade -->
            <div class="db-aside__identity">
                <div class="db-aside__brand">
                    <span class="db-aside__mark" aria-hidden="true">db</span>
                    <div class="db-aside__brand-text">
                        <p class="db-aside__eyebrow">Debit-Board</p>
                        <p class="db-aside__tagline">Application Security Posture Management</p>
                    </div>
                </div>

                <h1 class="db-aside__headline">
                    Segurança em<br>
                    <span class="db-aside__accent">um só lugar.</span>
                </h1>

                <p class="db-aside__lead">
                    A plataforma interna que unifica SAST e SCA, prioriza achados e
                    acelera a resposta do time de segurança.
                </p>
            </div>

            <#-- Features -->
            <div class="db-aside__features">
                <article class="db-feature">
                    <span class="db-feature__icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"/>
                            <path d="M9 12l2 2 4-4"/>
                        </svg>
                    </span>
                    <h3 class="db-feature__title">SAST unificado</h3>
                    <p class="db-feature__body">Achados consolidados de múltiplos scanners em um modelo único.</p>
                </article>

                <article class="db-feature">
                    <span class="db-feature__icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12h4l2-7 4 14 2-7h6"/>
                        </svg>
                    </span>
                    <h3 class="db-feature__title">Monitoramento contínuo</h3>
                    <p class="db-feature__body">SLA, severidade e status atualizados a cada varredura.</p>
                </article>

                <article class="db-feature">
                    <span class="db-feature__icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z"/>
                            <path d="M19 3l.7 2.1L22 6l-2.3.9L19 9l-.7-2.1L16 6l2.3-.9z"/>
                        </svg>
                    </span>
                    <h3 class="db-feature__title">Assistente IA</h3>
                    <p class="db-feature__body">Pergunte em linguagem natural sobre qualquer achado ou regra.</p>
                </article>

                <article class="db-feature">
                    <span class="db-feature__icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4" y="3" width="16" height="18" rx="1.5"/>
                            <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2"/>
                        </svg>
                    </span>
                    <h3 class="db-feature__title">Multi-tenant</h3>
                    <p class="db-feature__body">Isolamento completo por tenant, SSO via Keycloak.</p>
                </article>
            </div>

            <#-- Rodapé institucional -->
            <footer class="db-aside__footer">
                <span>v2026.9</span>
                <span aria-hidden="true">·</span>
                <span>Keycloak SSO</span>
                <span aria-hidden="true">·</span>
                <span>Internal use only</span>
            </footer>

        </div>
    </aside>

    <!-- ============================================================
         Coluna direita — card do formulário
         ============================================================ -->
    <main class="db-main">
        <div class="db-card">

            <#-- Header do card — espelha app/login/page.tsx:
                   1. <DebitBoardLogo size={50} />
                   2. h1 "Debit-Board"
                   3. p "Segurança em um só lugar"
                 O logo é o mesmo SVG do componente React (DebitBoardLogo.tsx),
                 com cores via custom properties do tema. -->
            <header class="db-card__brand">
                <svg class="db-card__logo"
                     viewBox="0 0 64 64"
                     width="50"
                     height="50"
                     role="img"
                     aria-label="Debit-Board">
                    <rect x="0" y="0" width="64" height="64" rx="14" ry="14"
                          style="fill: var(--button-primary-bg)"/>
                    <text x="32" y="43"
                          font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                          font-size="32"
                          font-weight="700"
                          text-anchor="middle"
                          letter-spacing="-2"
                          style="fill: var(--brand-foreground)">db</text>
                </svg>
                <h1 class="db-card__title">Debit-Board</h1>
                <p class="db-card__tagline">Segurança em um só lugar</p>
            </header>

            <#-- Mensagens globais (sessão expirada, erro genérico) -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="db-alert db-alert--${message.type}">
                    ${kcSanitize(message.summary)?no_esc}
                </div>
            </#if>

            <#-- Social providers (Google, Azure AD, etc., se habilitados) -->
            <#if socialProvidersNode?has_content>
                <div class="db-social">${socialProvidersNode}</div>
            </#if>

            <#-- Corpo: o formulário renderizado pelo `login.ftl` -->
            <div class="db-card__body">
                <#nested "form">
            </div>

            <#-- Info extra (ex.: link de registro) -->
            <#if displayInfo && infoNode?has_content>
                <div class="db-card__info">${infoNode}</div>
            </#if>

            <p class="db-card__footer">Autenticação gerenciada via Keycloak.</p>

        </div>
    </main>

    <#-- Detecção de SSO aberto em outra aba -->
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";
        startSessionPolling("${url.ssoLoginInOtherTabsUrl?no_esc}");
    </script>

</body>
</html>
</#macro>