<#--
  Debit Board — login form (tela única: usuário + senha + passkey)
  Wrapper (split 65/35, branding, footer) vem de `template.ftl`.
  Aqui montamos apenas o conteúdo da seção `form`.
-->
<#import "template.ftl" as layout>

<#--
  Fallback de placeholder: se a chave custom não existir no realm
  atual (ex.: master), usa texto PT-BR direto.
-->
<#assign ph_username = msg("usernameOrEmailPlaceholder")>
<#if ph_username == "usernameOrEmailPlaceholder" || !(ph_username?has_content)>
    <#assign ph_username = "Digite seu usuário ou e-mail">
</#if>

<#assign ph_placeholder_msg = msg("passwordPlaceholder")>
<#if ph_placeholder_msg == "passwordPlaceholder" || !(ph_placeholder_msg?has_content)>
    <#assign ph_placeholder_msg = "Digite sua senha">
</#if>

<@layout.registrationLayout; section>
    <#if section = "form">
        <div id="kc-form">
            <div id="kc-form-wrapper">
                <#if realm.password>
                    <form id="kc-form-login"
                          onsubmit="login.disabled = true; return true;"
                          action="${url.loginAction}"
                          method="post">

                        <#if !usernameHidden??>
                            <div class="db-field">
                                <label for="username" class="db-label">
                                    <#if !realm.loginWithEmailAllowed>
                                        ${msg("username")}
                                    <#elseif !realm.registrationEmailAsUsername>
                                        ${msg("usernameOrEmail")}
                                    <#else>
                                        ${msg("email")}
                                    </#if>
                                </label>
                                <input tabindex="1"
                                       id="username"
                                       class="db-input"
                                       name="username"
                                       value="${(login.username!'')}"
                                       type="text"
                                       autofocus
                                       autocomplete="username webauthn"
                                       aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                       placeholder="${ph_username}" />
                            </div>
                        </#if>

                        <div class="db-field">
                            <label for="password" class="db-label">
                                ${msg("password")}
                            </label>
                            <input tabindex="2"
                                   id="password"
                                   class="db-input"
                                   name="password"
                                   type="password"
                                   autocomplete="current-password"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                   placeholder="${ph_placeholder_msg}" />
                        </div>

                        <#if messagesPerField.existsError('username','password')>
                            <div class="db-error" role="alert" aria-live="polite">
                                ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                            </div>
                        </#if>

                        <#if realm.resetPasswordAllowed>
                            <div class="db-forgot">
                                <a tabindex="5" href="${url.loginResetCredentialsUrl}">
                                    ${msg("doForgotPassword")}
                                </a>
                            </div>
                        </#if>

                        <div id="kc-form-buttons" class="db-submit">
                            <input type="hidden"
                                   id="id-hidden-input"
                                   name="credentialId"
                                   <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if> />
                            <input tabindex="4"
                                   class="db-button db-button-primary"
                                   name="login"
                                   id="kc-login"
                                   type="submit"
                                   value="${msg("doLogIn")}" />
                        </div>
                    </form>
                </#if>
            </div>
        </div>

        <#-- ============================================================
             Passkey / WebAuthn — self-contained, sem rfc4648.
             Só renderiza quando o Keycloak gerou um challenge real
             (o que acontece nativamente no flow de passo único).
             ============================================================ -->
        <#if webAuthnChallenge?? && webAuthnChallenge?has_content>
        <div class="db-webauthn">
            <form id="webauth" action="${url.loginAction}" method="post" hidden>
                <input type="hidden" id="clientDataJSON" name="clientDataJSON" />
                <input type="hidden" id="authenticatorData" name="authenticatorData" />
                <input type="hidden" id="signature" name="signature" />
                <input type="hidden" id="credentialId" name="credentialId" />
                <input type="hidden" id="userHandle" name="userHandle" />
                <input type="hidden" id="error" name="error" />
            </form>

            <a id="authenticateWebAuthnButton" href="#" class="db-webauthn-btn">
                Entrar com chave de segurança
            </a>

            <script>
            (function () {
                "use strict";

                function b64urlToBytes(str) {
                    if (!str) return new Uint8Array(0);
                    try {
                        var b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
                        while (b64.length % 4) b64 += "=";
                        var bin = atob(b64);
                        var out = new Uint8Array(bin.length);
                        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
                        return out;
                    } catch (e) {
                        return new Uint8Array(0);
                    }
                }

                function bytesToB64url(bytes) {
                    if (!bytes) return "";
                    var bin = "";
                    for (var i = 0; i < bytes.length; i++) {
                        bin += String.fromCharCode(bytes[i]);
                    }
                    return btoa(bin)
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_")
                        .replace(/=+$/, "");
                }

                var ARGS = {
                    challenge: "${webAuthnChallenge!'0'}",
                    rpId: "${(realm.webAuthnPolicyRpId!url.host)!}",
                    userVerification: "${(realm.webAuthnPolicyUserVerificationRequirement!'preferred')}",
                    createTimeout: ${(realm.webAuthnPolicyCreateTimeout!0)?c},
                    isUserIdentified: ${(auth.attemptedUsername!'')?has_content?c},
                    errmsg: "Chave de segurança não suportada por este navegador."
                };

                function submitForm(result) {
                    var f = document.getElementById("webauth");
                    if (!f) return;
                    f.querySelector("#clientDataJSON").value    = result.clientDataJSON || "";
                    f.querySelector("#authenticatorData").value = result.authenticatorData || "";
                    f.querySelector("#signature").value         = result.signature || "";
                    f.querySelector("#credentialId").value      = result.credentialId || "";
                    f.querySelector("#userHandle").value        = result.userHandle || "";
                    f.querySelector("#error").value             = result.error || "";
                    f.submit();
                }

                function authenticate(mediation) {
                    if (!window.PublicKeyCredential) {
                        alert(ARGS.errmsg);
                        return Promise.resolve(null);
                    }

                    var challengeBytes = b64urlToBytes(ARGS.challenge);
                    if (!challengeBytes.length) {
                        return Promise.resolve({
                            error: "Challenge WebAuthn ausente. Recarregue a página."
                        });
                    }

                    var publicKey = {
                        challenge: challengeBytes,
                        rpId: ARGS.rpId
                    };

                    if (ARGS.userVerification && ARGS.userVerification !== "not specified") {
                        publicKey.userVerification = ARGS.userVerification;
                    }
                    if (ARGS.createTimeout && ARGS.createTimeout !== 0) {
                        publicKey.timeout = ARGS.createTimeout * 1000;
                    }

                    return navigator.credentials
                        .get({ publicKey: publicKey, mediation: mediation })
                        .then(function (credential) {
                            var r = credential.response;
                            return {
                                clientDataJSON:    bytesToB64url(new Uint8Array(r.clientDataJSON)),
                                authenticatorData: bytesToB64url(new Uint8Array(r.authenticatorData)),
                                signature:         bytesToB64url(new Uint8Array(r.signature)),
                                credentialId:      credential.id,
                                userHandle:        r.userHandle
                                    ? bytesToB64url(new Uint8Array(r.userHandle))
                                    : ""
                            };
                        })
                        .catch(function (err) {
                            if (err && err.name === "AbortError") return null;
                            return { error: (err && err.message) || "Erro WebAuthn" };
                        });
                }

                function wire() {
                    var btn = document.getElementById("authenticateWebAuthnButton");
                    if (!btn) return;
                    btn.addEventListener("click", function (e) {
                        e.preventDefault();
                        authenticate("optional").then(function (result) {
                            if (result) submitForm(result);
                        });
                    });
                }

                if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", wire);
                } else {
                    wire();
                }
            })();
            </script>
        </div>
        </#if>

    <#elseif section = "info">
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <p class="db-register">
                ${msg("noAccount")}
                <a tabindex="6" href="${url.registrationUrl}">${msg("doRegister")}</a>
            </p>
        </#if>
    </#if>
</@layout.registrationLayout>