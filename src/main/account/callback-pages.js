"use strict";

/** Page locale de résultat OAuth sans chargement distant. */
function browserResponseHtml(success) {
  const title = success ? "Connexion terminée" : "Connexion refusée";
  const detail = success
    ? "Vous pouvez fermer cette page et revenir dans ShenPulse."
    : "Revenez dans ShenPulse puis relancez la connexion.";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426"><h1>${title}</h1><p style="color:#aeb6cf">${detail}</p></main></body></html>`;
}

/** Transmet le fragment Google à la boucle locale puis l'efface de l'historique. */
function googleBrowserCallbackHtml() {
  return `<!doctype html>
<html lang="fr">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connexion Google ShenPulse</title>
  <body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh">
    <main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426">
      <h1 id="title">Connexion en cours…</h1>
      <p id="detail" style="color:#aeb6cf">ShenPulse vérifie le retour Google sur cet appareil.</p>
    </main>
    <script>
      (async () => {
        const values = new URLSearchParams(location.hash.slice(1));
        const payload = {
          error: values.get("error") || "",
          idToken: values.get("id_token") || "",
          state: values.get("state") || ""
        };
        history.replaceState(null, "", location.pathname);
        try {
          const response = await fetch("/callback/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error();
          document.getElementById("title").textContent = "Connexion terminée";
          document.getElementById("detail").textContent =
            "Vous pouvez fermer cette page et revenir dans ShenPulse.";
        } catch {
          document.getElementById("title").textContent = "Connexion refusée";
          document.getElementById("detail").textContent =
            "Revenez dans ShenPulse puis relancez la connexion Google.";
        }
      })();
    </script>
  </body>
</html>`;
}

/** Résultat visible du retour du paiement : aucune donnée de paiement interpolée. */
function paymentResponseHtml(status) {
  const cancelled = status === "cancelled";
  const error = status === "error";
  const title = error
    ? "Retour PayPal refusé"
    : cancelled
      ? "Paiement annulé"
      : "Paiement validé";
  const detail = error
    ? "Ce retour ne correspond pas au paiement lancé depuis ShenPulse."
    : cancelled
      ? "ShenPulse a bien reçu l’annulation. Vous pouvez fermer cette page."
      : "ShenPulse finalise votre achat et synchronise vos accès. Vous pouvez fermer cette page.";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426"><h1>${title}</h1><p style="color:#aeb6cf">${detail}</p></main></body></html>`;
}

module.exports = { browserResponseHtml, googleBrowserCallbackHtml, paymentResponseHtml };
