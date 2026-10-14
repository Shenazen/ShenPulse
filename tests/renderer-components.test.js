"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { JSDOM } = require("jsdom");

function createComponents() {
  const context = vm.createContext({
    escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "core", "components.js"), "utf8"), context);
  return context;
}

test("le champ réutilisable garde les attributs, échappe les valeurs et présente l’aide", () => {
  const context = createComponents();
  const markup = context.inputFieldMarkup("gift\"name", "Nom <cadeau>", "<img src=x>", "text", "full required maxlength=20", { informative: true, help: "Explication <sûre>" });
  const dom = new JSDOM(markup);
  const input = dom.window.document.querySelector("input");
  assert.equal(input.name, 'gift"name');
  assert.equal(input.value, "<img src=x>");
  assert.equal(input.required, true);
  assert.equal(input.maxLength, 20);
  assert.ok(input.closest("label").classList.contains("full"));
  assert.equal(dom.window.document.querySelectorAll("img").length, 0);
  assert.equal(dom.window.document.querySelector('[role="tooltip"]').textContent, "Explication <sûre>");
  dom.window.close();
});

test("le sélecteur réutilisable conserve la comparaison textuelle des valeurs", () => {
  const context = createComponents();
  const dom = new JSDOM(context.selectFieldMarkup("duration", "Durée", 2, [[1, "Un"], ["2", "Deux <tests>"]], { full: true }));
  assert.equal(dom.window.document.querySelector("select").value, "2");
  assert.equal(dom.window.document.querySelector("option:checked").textContent, "Deux <tests>");
  dom.window.close();
});

test("les trois formats fréquents sont construits une fois puis réutilisés", () => {
  const context = createComponents();
  const result = vm.runInContext("({ integer: rendererFormatters.integer.format(12345), compact: rendererFormatters.compact.format(12345), time: typeof rendererFormatters.time.format, fixed: Object.isFrozen(rendererFormatters) })", context);
  assert.equal(result.integer, new Intl.NumberFormat("fr-FR").format(12345));
  assert.equal(result.compact, new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(12345));
  assert.equal(result.time, "function");
  assert.equal(result.fixed, true);
});

test("la table de ressources partage le rendu et échappe identités et attributs", () => {
  const context = createComponents();
  const dom = new JSDOM(context.renderCompactResourceTable({ key: 'test"', label: "Machines <IRL>",
    columns: [{ key: "name", label: "Nom <machine>" }, { key: 'bad" onclick=', label: "Invalide" }],
    rows: [{ id: 'id" onfocus="x', className: 'test" onclick="x', attributes: { "data-chatbot-entry": 'x" onclick="evil', onclick: "evil", "data-bad<": "evil" }, cells: { name: "<strong>Texte interne sûr</strong>" } }]
  }));
  const table = dom.window.document.querySelector("table"), row = table.tBodies[0].rows[0];
  assert.equal(table.getAttribute("aria-label"), "Machines <IRL>");
  assert.equal(table.querySelectorAll("th").length, 1);
  assert.equal(row.dataset.rowId, 'id" onfocus="x');
  assert.equal(row.dataset.chatbotEntry, 'x" onclick="evil');
  assert.equal(row.hasAttribute("onclick"), false);
  assert.equal(row.hasAttribute("onfocus"), false);
  assert.equal(row.querySelector("strong").textContent, "Texte interne sûr");
  dom.window.close();
});

test("la table vide affiche un message textuel sans contrôle opérationnel", () => {
  const context = createComponents();
  const dom = new JSDOM(context.renderCompactResourceTable({ key: "empty", label: "Vide",
    columns: [{ key: "name", label: "Nom" }, { key: "status", label: "Statut" }], rows: [], emptyText: "<script>Texte</script>" }));
  assert.equal(dom.window.document.querySelector("td").colSpan, 2);
  assert.equal(dom.window.document.querySelector("td").textContent, "<script>Texte</script>");
  assert.equal(dom.window.document.querySelector("script, button"), null);
  dom.window.close();
});
