"use strict";
(() => {
  const query = new URLSearchParams(location.search);
  const profile = query.get("profile") || "", packId = query.get("jeu") || "supermarket-simulator";
  const compact = query.get("layout") === "compact";
  let fixed = query.get("motion") === "fixed" || (!query.has("motion") && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const root = document.getElementById("pack"), cardsRoot = document.getElementById("cards"), reaction = document.getElementById("reaction");
  document.body.className = (compact ? "compact " : "") + (fixed ? "fixed" : "animated");
  const PAGE_SIZE = 6, PAGE_DURATION_MS = 8000;
  let pageIndex = 0, pageCount = 0, pageTimer = null, renderRevision=0, model=1;
  let currentProfileId = "", current = null, signature = "", source = null, retry = null, poll = null, documentValue = {}, initialized = false, lastBatch = "", reactionTimer;
  const renderStatus = document.getElementById("render-status") || document.body.appendChild(document.createElement("div"));
  renderStatus.id = "render-status"; renderStatus.className = "pack-render-status";
  renderStatus.setAttribute("role", "status"); renderStatus.setAttribute("aria-live", "polite");
  const spinner = document.createElement("i"), statusText = document.createElement("span");
  spinner.setAttribute("aria-hidden", "true"); renderStatus.replaceChildren(spinner, statusText);
  function setRenderStatus(value) {
    const busy = value === "loading";
    root.setAttribute("aria-busy", String(busy));
    renderStatus.dataset.state = value;
    renderStatus.hidden = !compact || value === "ready";
    statusText.textContent = value === "error" ? "Le modèle n’a pas pu être chargé." : cardsRoot.hasChildNodes() ? "Mise à jour de l’aperçu…" : "Chargement de l’aperçu…";
  }
  function applyPresentation() {
    document.body.className = (compact ? "compact " : "") + (fixed ? "fixed" : "animated") + (model === 1 ? "" : " legacy model-" + model);
    root.dataset.model = String(model);
  }
  setRenderStatus("loading");
  function resize() {
    const height = compact ? Math.max(650, (cardsRoot.scrollHeight || 610) + 40) : Math.max(1920, (cardsRoot.scrollHeight || 0) + 140);
    root.style.height = height + "px";
    const scale = Math.min(innerWidth / 1080, innerHeight / height);
    root.style.transform = "scale(" + scale + ")";
    root.style.left = (innerWidth - 1080 * scale) / 2 + "px";
    root.style.top = (innerHeight - height * scale) / 2 + "px";
  }
  function valid(state) { return state?.enabled === true && state.packId === packId && (!profile || state.profileId === profile); }
  function showPage(index) {
    pageIndex = pageCount ? index % pageCount : 0;
    cardsRoot.dataset.page = String(pageIndex + 1);
    for (const page of cardsRoot.querySelectorAll(".pack-page")) {
      const active = Number(page.dataset.pageIndex) === pageIndex;
      page.classList.toggle("is-current", active);
      page.setAttribute("aria-hidden", String(!active));
    }
  }
  function syncPagination(restart = false) {
    if (restart || pageCount <= 1) { clearInterval(pageTimer); pageTimer = null; }
    if (pageCount > 1 && pageTimer === null) pageTimer = setInterval(() => showPage(pageIndex + 1), PAGE_DURATION_MS);
  }
  function createBrand() {
    const brand = document.createElement("div"); brand.className = "brand";
    const left = document.createElement("i"), right = document.createElement("i"), mark = document.createElement("span"), logo = document.createElement("img");
    left.className = "brand-line left"; right.className = "brand-line right"; left.setAttribute("aria-hidden", "true"); right.setAttribute("aria-hidden", "true");
    mark.className = "brand-mark"; logo.src = "brand/shenpulse-logo.png?v=20261024-4"; logo.alt = "ShenPulse"; logo.width = 1583; logo.height = 320; mark.append(logo);
    brand.append(left, mark, right); return brand;
  }
  let triggerArtSequence = 0;
  function createSocialArt(type) {
    const id = 'social-art-' + (++triggerArtSequence), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 96 96'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('social-art', type === 'follow' ? 'follow-art' : 'likes-art');
    // Fixed vector artwork, never markup from a viewer or a saved interaction.
    svg.innerHTML = type === 'follow'
      ? '<defs><linearGradient id="'+id+'" x2="0" y2="1"><stop stop-color="#22e2ec"/><stop offset="1" stop-color="#4178ec"/></linearGradient></defs><circle cx="37" cy="25" r="15" fill="url(#'+id+')"/><path d="M9 79c0-22 11-34 28-34s28 12 28 34z" fill="url(#'+id+')"/><path d="M15 73c2-11 9-19 20-21" fill="none" stroke="#a1ffff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/><circle cx="71" cy="65" r="18" fill="#ef36bf"/><path d="M71 55v20m-10-10h20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
      : '<defs><linearGradient id="'+id+'" x2="0" y2="1"><stop stop-color="#ff588d"/><stop offset="1" stop-color="#ed2771"/></linearGradient></defs><path d="M48 85C36 75 8 56 8 32 8 8 37 5 48 25 59 5 88 8 88 32 88 56 60 75 48 85z" fill="url(#'+id+')"/><path d="M18 31c0-9 7-15 15-14" fill="none" stroke="#ffbed6" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>';
    return svg;
  }
  function createCard(card, slot, rowName) {
    const item = document.createElement("article");
    const level = card.giftCost >= 299 ? 3 : card.giftCost >= 99 ? 2 : 1;
    item.className = "gift-card " + card.column + " " + (level >= 2 ? "gold" : "silver"); item.dataset.rule = card.id;
    item.style.setProperty("--foil-delay", ((rowName === "trap" ? 2.7 : 0) + slot * 0.9).toFixed(1) + "s");
    const face = document.createElement("div"); face.className = "card-face";
    const rays = document.createElement("span"), foil = document.createElement("span"); rays.className = "card-rays"; foil.className = "card-foil";
    rays.setAttribute("aria-hidden", "true"); foil.setAttribute("aria-hidden", "true");
    const stars = document.createElement("span"); stars.className = "card-stars"; stars.textContent = "★".repeat(level); stars.setAttribute("aria-hidden", "true");
    const category = document.createElement("span"); category.className = "category"; category.textContent = { help: "AIDE", neutral: "NEUTRE", trap: "PIÈGE" }[card.column];
    const art = document.createElement("span"); art.className = "art";
    if (['follow','like','likes'].includes(card.triggerType)) art.append(createSocialArt(card.triggerType));
    else art.textContent = '🎁';
    if (card.triggerType === "gift" && /^https:\/\//.test(card.giftImageUrl || "")) {
      const img = document.createElement("img"); img.src = card.giftImageUrl; img.alt = card.giftName || "Cadeau"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.remove(); art.textContent = "🎁"; }, { once: true }); art.replaceChildren(img);
    }
    const title = document.createElement("h2"); title.textContent = card.title;
    const detail = document.createElement("small"); detail.textContent = card.triggerType === "gift" ? (card.giftCost ? card.giftCost + " ●" : "") : card.triggerType === "follow" ? "FOLLOW" : card.threshold + " LIKES";
    face.append(rays, foil, category, stars, art, title, detail); item.append(face); return item;
  }
  function render(state) {
    state = state?.packs?.[packId] || state;
    const previousProfile = currentProfileId;
    current = valid(state) ? state : null;
    currentProfileId = current?.profileId || "";
    const presentation=current?.presentation||{};
    model=[1,2,3].includes(Number(presentation.model))?Number(presentation.model):1;
    fixed=model!==1||(presentation.configured===true?presentation.motion==="fixed":query.get("motion")==="fixed"||(!query.has("motion")&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
    const next = JSON.stringify([current?.profileId || "", current?.cards || [],model,presentation.backgroundColor||""]);
    if (next === signature) { if (root.getAttribute("aria-busy") !== "true") applyPresentation(); return; }
    signature = next; const revision = ++renderRevision;
    reaction.classList.remove("visible");
    // Aucun rendu de l’ancien profil ne doit survivre à un changement de session.
    if (previousProfile !== current?.profileId || !current?.cards?.length) cardsRoot.replaceChildren();
    if(model!==1){
      pageCount=0;cardsRoot.dataset.pages="0";syncPagination(true);
      if(!current?.cards?.length){applyPresentation();setRenderStatus("ready");resize();return;}
      setRenderStatus("loading");
      let rendering;
      try { rendering = window.ShenPulseGamePackModels.render(current,model,compact); }
      catch (error) { rendering = Promise.reject(error); }
      rendering.then(canvas => {
        if(revision!==renderRevision)return;
        canvas.className="legacy-pack-canvas";
        canvas.setAttribute("aria-label","Modèle "+model+" · Interactions du profil");
        cardsRoot.replaceChildren(canvas);applyPresentation();setRenderStatus("ready");resize();
      }).catch(() => {
        if(revision!==renderRevision)return;
        signature="";setRenderStatus("error");resize();
      });
      return;
    }
    applyPresentation();setRenderStatus("ready");
    const top = (current?.cards || []).filter(card => card.column === "help");
    const bottom = (current?.cards || []).filter(card => card.column === "trap" || card.column === "neutral");
    pageCount = Math.max(Math.ceil(top.length / PAGE_SIZE), Math.ceil(bottom.length / PAGE_SIZE));
    pageIndex = previousProfile !== current?.profileId ? 0 : Math.min(pageIndex, Math.max(0, pageCount - 1));
    cardsRoot.dataset.pages = String(pageCount);
    if (!pageCount) { cardsRoot.replaceChildren(); cardsRoot.dataset.page = "0"; syncPagination(); resize(); return; }
    const pages = document.createElement("div"); pages.className = "pack-pages";
    for (let index = 0; index < pageCount; index++) {
      const page = document.createElement("section"); page.className = "pack-page"; page.dataset.pageIndex = String(index);
      page.setAttribute("aria-label", "Page " + (index + 1) + " sur " + pageCount);
      for (const [rowName, entries] of [["help", top], ["trap", bottom]]) {
        const row = document.createElement("section"); row.className = "pack-row " + rowName;
        row.setAttribute("aria-label", rowName === "help" ? "Aides" : "Pièges et neutres");
        entries.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE).forEach((card, slot) => row.append(createCard(card, slot, rowName)));
        page.append(row);
      }
      pages.append(page);
    }
    pages.append(createBrand()); cardsRoot.replaceChildren(pages);
    showPage(pageIndex); syncPagination(previousProfile !== current?.profileId); resize();
  }
  function trigger(payload) {
    if (model!==1 || !current || payload.profileId !== current.profileId || payload.packId !== packId) return;
    const card = current.cards.find((item) => item.id === payload.ruleId); if (!card) return;
    const node = [...cardsRoot.querySelectorAll(".gift-card")].find((item) => item.dataset.rule === payload.ruleId);
    if (node) {
      const targetPage = Number(node.closest(".pack-page")?.dataset.pageIndex);
      if (Number.isInteger(targetPage) && targetPage !== pageIndex) { showPage(targetPage); syncPagination(true); }
    }
    if (!fixed && node) { node.classList.remove("hit"); void node.offsetWidth; node.classList.add("hit"); setTimeout(() => node.classList.remove("hit"), 1550); }
    reaction.textContent = (payload.viewer || "Viewer") + " · " + card.title; reaction.classList.add("visible");
    clearTimeout(reactionTimer); reactionTimer = setTimeout(() => reaction.classList.remove("visible"), 4500);
  }
  function message(frame) { if (frame?.channel === "game-pack-trigger") trigger(frame.payload || {}); }
  function mutate(path, data, patch) {
    const parts = String(path || "/").split("/").filter(Boolean);
    if (!parts.length) { documentValue = patch ? { ...documentValue, ...data } : data || {}; return; }
    let cursor = documentValue;
    for (const key of parts.slice(0, -1)) { if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {}; cursor = cursor[key]; }
    const key = parts.at(-1);
    if (data === null) delete cursor[key]; else cursor[key] = patch ? { ...cursor[key], ...data } : data;
  }
  function connectPublic() {
    const channel = query.get("channel");
    source = new EventSource("https://shenazenoverlay-default-rtdb.firebaseio.com/publicOverlayRelay/" + encodeURIComponent(channel) + ".json");
    const receive = (event, patch) => {
      try {
        const change = JSON.parse(event.data); mutate(change.path, change.data, patch);
        if (documentValue.presence?.connected === false) { render(null); return; }
        render(documentValue.state?.gamePacks);
        const batch = documentValue.lastBatch;
        if (initialized && batch?.id && batch.id !== lastBatch) {
          if (batch.state?.gamePacks) render(batch.state.gamePacks);
          for (const frame of Object.values(batch.messages || {})) message(frame);
        }
        lastBatch = batch?.id || ""; initialized = true;
      } catch { /* Keep the last valid frame during a partial network update. */ }
    };
    source.addEventListener("put", (event) => receive(event, false)); source.addEventListener("patch", (event) => receive(event, true));
    source.addEventListener("error", () => { source.close(); initialized = false; clearTimeout(retry); retry = setTimeout(connectPublic, 3000); });
  }
  function connectLocal() {
    const token = query.get("token") || "", params = new URLSearchParams({ token, view: "game-pack" });
    const refresh = async () => { try { const response = await fetch("/api/game-pack?" + params, { cache: "no-store" }); if (!response.ok) { render(null); return; } render(await response.json()); } catch { render(null); } };
    refresh(); poll = setInterval(refresh, 1000);
    source = new EventSource("/events?" + params);
    source.addEventListener("bootstrap", (event) => { try { render(JSON.parse(event.data).payload?.gamePacks); } catch { /* Invalid bootstrap. */ } });
    source.addEventListener("game-pack-trigger", (event) => { try { message(JSON.parse(event.data)); } catch { /* Invalid event. */ } });
  }
  addEventListener("resize", resize);
  addEventListener("pagehide", () => { source?.close(); clearTimeout(retry); clearInterval(poll); clearInterval(pageTimer); clearTimeout(reactionTimer); });
  // Read-only browser source: it never dispatches game effects or starts a LIVE.
  window.ShenPulseGamePack = { render, trigger };
  resize(); if (query.get("channel")) connectPublic(); else if (query.get("token")) connectLocal();
})();
