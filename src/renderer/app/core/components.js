"use strict";

/** Champs communs : les pages et éditeurs conservent leurs noms et attributs métier. */
function fieldLabelWithInfo(label, help) {
  return `<span class="field-label-with-info">
    <span>${escapeHtml(label)}</span>
    <button type="button" class="field-info-button" aria-label="Information : ${escapeHtml(label)}" title="${escapeHtml(help)}">i</button>
    <span class="field-info-popover" role="tooltip">${escapeHtml(help)}</span>
  </span>`;
}

function inputFieldMarkup(name, label, value = "", type = "text", extra = "", { help, informative = false } = {}) {
  const labelMarkup = informative ? fieldLabelWithInfo(label, help || "") : `<span>${escapeHtml(label)}</span>`;
  return `<label class="field ${extra.includes("full") ? "full" : ""}">${labelMarkup}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${extra.replace("full", "")}></label>`;
}

function selectFieldMarkup(name, label, value, options, { full = false, help, informative = false } = {}) {
  const labelMarkup = informative ? fieldLabelWithInfo(label, help || "") : `<span>${escapeHtml(label)}</span>`;
  return `<label class="field ${full ? "full" : ""}">${labelMarkup}<select name="${escapeHtml(name)}">${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

/** Un formatteur Intl est coûteux à construire : réutilisation bornée des formats fixes. */
const rendererFormatters = Object.freeze({
  integer: new Intl.NumberFormat("fr-FR"),
  compact: new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }),
  time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  euro: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
});

/** Liste tabulaire partagée des ressources, sans écouteur ni effet au rendu.
 * Les cellules HTML viennent exclusivement des composants internes. Les
 * identités, libellés et attributs de données sont toujours échappés ici.
 */
function renderCompactResourceTable({ key, label, columns, rows, className = "", emptyText = "Aucune entrée." }) {
  const safeColumns = columns.filter((column) => /^[a-zA-Z0-9_-]+$/.test(column.key));
  return `<div class="compact-resource-table-wrap ${escapeHtml(className)}" data-resource-table="${escapeHtml(key)}"><table class="compact-resource-table" aria-label="${escapeHtml(label)}">
    <thead><tr>${safeColumns.map((column) => `<th scope="col" class="compact-resource-column-${column.key}">${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => {
      const attributes = Object.entries(row.attributes || {}).filter(([name]) =>
        /^data-[a-z][a-z0-9-]*$/.test(name) && !["data-row-id", "data-resource-row-id"].includes(name)
      ).map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(" ");
      return `<tr class="${escapeHtml(row.className || "")}" data-row-id="${escapeHtml(row.id)}" data-resource-row-id="${escapeHtml(row.id)}" ${attributes}>${safeColumns.map((column) =>
        `<td class="compact-resource-column-${column.key}">${row.cells?.[column.key] || "—"}</td>`
      ).join("")}</tr>`;
    }).join("") || `<tr><td class="compact-resource-empty" colspan="${safeColumns.length}">${escapeHtml(emptyText)}</td></tr>`}</tbody>
  </table></div>`;
}
