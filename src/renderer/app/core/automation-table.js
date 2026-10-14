"use strict";

/** Table compacte partagée par les actions, déclencheurs et alertes audio.
 * Le rendu est pur. La sélection et le tri sont locaux au DOM : aucun ordre,
 * droit, déclencheur ou réglage du profil n'est modifié par ces outils.
 * Les cellules HTML sont construites uniquement par les composants internes ;
 * tous les textes et identifiants provenant du profil sont échappés ici.
 */
const AUTOMATION_TABLE_ICONS = Object.freeze({
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  edit: '<path d="m14 5 5 5M4 16l-1 5 5-1L21 7l-5-5ZM12 5H5a2 2 0 0 0-2 2v5M12 21h7a2 2 0 0 0 2-2v-7"/>',
  copy: '<rect x="9" y="3" width="12" height="14" rx="2" fill="currentColor" stroke="none"/><path d="M6 7H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  voice: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  overlay: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  action: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  drag: '<circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="19" r="1.4"/>',
  sort: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>'
});
const AUTOMATION_TABLE_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

function automationTableIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${AUTOMATION_TABLE_ICONS[name] || AUTOMATION_TABLE_ICONS.action}</svg>`;
}

function renderAutomationIconButton({ action, label, attributes = "", icon = "edit", tone = "edit", disabled = false }) {
  return `<button type="button" class="automation-icon-button is-${escapeHtml(tone)}" data-action="${escapeHtml(action)}" ${attributes} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${disabled ? "disabled" : ""}>${automationTableIcon(icon)}</button>`;
}

function renderAutomationEffectChip({ label, kind = "", tone = "violet", icon = "action" }) {
  return `<span class="automation-effect-pair"><span class="automation-effect-chip" data-tone="${escapeHtml(tone)}" title="${escapeHtml(label)}">${automationTableIcon(icon)}<span data-studio-user-content>${escapeHtml(label)}</span></span>${kind ? `<span class="automation-effect-kind">${escapeHtml(kind)}</span>` : ""}</span>`;
}

function renderAutomationStatus(rule) {
  return `<label class="automation-status-toggle workflow-state audio-rule-state" title="Activer ou désactiver toute la règle"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" aria-label="Activer ou désactiver ${escapeHtml(rule.name)}" ${rule.enabled ? "checked" : ""}><span><i aria-hidden="true"></i><small>${rule.enabled ? "Actif" : "Inactif"}</small></span></label>`;
}

function automationTableDate(value) {
  if (!value) return { text: "—", timestamp: 0 };
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return { text: "—", timestamp: 0 };
  return { text: AUTOMATION_TABLE_DATE_FORMATTER.format(timestamp), timestamp };
}

function renderAutomationTable({ key, label, rows, className = "" }) {
  const tableKey = escapeHtml(key);
  const columns = [["select", ""], ["name", "Nom"], ["trigger", "Déclencheur"], ["effects", "Actions exécutées"], ["status", "Statut"], ["date", "Date"], ["commands", "Actions"]];
  return `<div class="automation-table-wrap ${escapeHtml(className)}" data-automation-table-wrap="${tableKey}"><table class="automation-table" data-automation-table="${tableKey}" aria-label="${escapeHtml(label)}">
    <colgroup>${columns.map(([name]) => `<col class="automation-column-${name}">`).join("")}</colgroup>
    <thead><tr>${columns.map(([name, title]) => `<th scope="col" class="automation-column-${name}" ${["name", "status", "date"].includes(name) ? 'aria-sort="none"' : ""}>${name === "select" ? '<input type="checkbox" class="automation-selection" data-automation-select-all aria-label="Sélectionner toutes les lignes affichées">' : ["name", "status", "date"].includes(name) ? `<button type="button" class="automation-table-sort" data-automation-sort="${name}">${title}${automationTableIcon("sort")}</button>` : title}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => {
      const date = automationTableDate(row.date);
      return `<tr class="${escapeHtml(row.className || "")}" data-automation-row="${escapeHtml(row.id)}" data-automation-name="${escapeHtml(row.name)}" data-automation-date="${date.timestamp}">
        <td class="automation-column-select"><input type="checkbox" class="automation-selection" data-automation-select aria-label="Sélectionner ${escapeHtml(row.name)}"></td>
        <td class="automation-column-name"><div class="automation-name-cell"><span class="automation-name-grip" aria-hidden="true">${automationTableIcon("drag")}</span><div class="automation-name-copy"><strong data-studio-user-content>${escapeHtml(row.name)}</strong>${row.detail ? `<div class="automation-row-note">${row.detail}</div>` : ""}</div></div></td>
        <td class="automation-column-trigger">${row.trigger || "—"}</td>
        <td class="automation-column-effects"><div class="automation-effect-list">${row.effects || '<span class="automation-row-note">Aucune action</span>'}</div></td>
        <td class="automation-column-status">${row.status || "—"}</td>
        <td class="automation-column-date">${date.text}</td>
        <td class="automation-column-commands"><div class="automation-row-controls">${row.commands || ""}</div></td>
      </tr>`;
    }).join("") || '<tr><td colspan="7" class="automation-table-empty">Aucune entrée à afficher.</td></tr>'}</tbody></table><p class="automation-table-selection-summary" data-automation-selection-summary role="status" hidden></p></div>`;
}

/** Les cases de sélection ne sont pas des interrupteurs d'automatisation. */
function handleAutomationTableSelection(event) {
  const target = event.target;
  if (!target.matches?.("[data-automation-select], [data-automation-select-all]")) return;
  const table = target.closest("[data-automation-table]");
  if (!table) return;
  const controls = [...table.querySelectorAll("[data-automation-select]")];
  if (target.hasAttribute("data-automation-select-all")) for (const control of controls) control.checked = target.checked;
  let count = 0;
  for (const control of controls) {
    control.closest("tr").classList.toggle("automation-row-selected", control.checked);
    if (control.checked) count += 1;
  }
  const all = table.querySelector("[data-automation-select-all]");
  all.checked = controls.length > 0 && count === controls.length;
  all.indeterminate = count > 0 && count < controls.length;
  const summary = table.closest("[data-automation-table-wrap]").querySelector("[data-automation-selection-summary]");
  summary.hidden = count === 0;
  summary.textContent = `${count} ligne${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""} · sélection locale, aucune action déclenchée`;
}

/** Trie les lignes déjà affichées, sans toucher les références ou les filtres. */
function handleAutomationTableSort(event) {
  const control = event.target.closest?.("[data-automation-sort]");
  if (!control) return;
  const table = control.closest("[data-automation-table]");
  if (!table) return;
  const head = control.closest("th");
  const direction = head.getAttribute("aria-sort") === "ascending" ? -1 : 1;
  const key = control.dataset.automationSort;
  if (!["name", "status", "date"].includes(key)) return;
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const value = (row) => key === "status" ? Number(row.querySelector('[data-action="toggle-rule"]')?.checked)
    : key === "date" ? Number(row.dataset.automationDate) : row.dataset.automationName;
  const rows = [...table.tBodies[0].rows].sort((a, b) => direction * (key === "name" ? collator.compare(value(a), value(b)) : value(a) - value(b)));
  const fragment = document.createDocumentFragment();
  for (const row of rows) fragment.appendChild(row);
  table.tBodies[0].appendChild(fragment);
  for (const header of table.querySelectorAll("[aria-sort]")) header.setAttribute("aria-sort", header === head ? direction === 1 ? "ascending" : "descending" : "none");
}

