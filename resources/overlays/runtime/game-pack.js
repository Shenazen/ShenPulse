"use strict";
(() => {
  const query = new URLSearchParams(location.search);
  const profile = query.get("profile") || "", packId = query.get("jeu") || "supermarket-simulator";
  const compact = query.get("layout") === "compact", fitCards = compact && query.get("fit") === "cards", fitPanel = compact && query.get("fit") === "panel";
  let fixed = query.get("motion") === "fixed" || (!query.has("motion") && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const root = document.getElementById("pack"), cardsRoot = document.getElementById("cards"), reaction = document.getElementById("reaction");
  document.body.className = (compact ? "compact " : "") + (fixed ? "fixed" : "animated");
  const PAGE_SIZE = 6, PAGE_DURATION_MS = 8000;
  let customLayout=null, layoutArea=null, pageCapacity=PAGE_SIZE;
  let pageIndex = 0, pageCount = 0, pageTimer = null, renderRevision=0, model=1;
  let currentProfileId = "", current = null, signature = "", source = null, retry = null, poll = null, documentValue = {}, initialized = false, lastBatch = "", reactionTimer;
  const editorPreview = window.ShenPulseGamePackLayout.createPreviewReceiver({query,packId,profile,onChange: state => render(state)});
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
    document.body.classList.toggle('custom-layout',!!customLayout);
    document.body.classList.toggle('cards-sides',customLayout?.cardPlacement==='sides');
    document.body.classList.toggle('traps-first',customLayout?.rowOrder==='trap-first');
    reaction.style.removeProperty('top');
    if(customLayout){
      if (fitCards || fitPanel) { reaction.style.top = (layoutArea.gifts.y + layoutArea.gifts.height / 2) + 'px'; }
      const b=layoutArea.gifts;Object.assign(cardsRoot.style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px',right:'auto',bottom:'auto'});
      root.style.setProperty('--card-scale',customLayout.cardSize/100);
      root.style.setProperty('--cards-per-page',pageCapacity);
    }else{cardsRoot.removeAttribute('style');root.style.removeProperty('--card-scale');}

  }
  // La bordure suit l'alpha : ni rectangle noir, ni flou sur l'image originale.
  const relief=document.createElementNS('http://www.w3.org/2000/svg','svg');
  relief.setAttribute('width','0');relief.setAttribute('height','0');relief.setAttribute('aria-hidden','true');relief.style.position='absolute';
  relief.innerHTML='<defs><filter id="shen-gift-relief" x="-35%" y="-35%" width="170%" height="185%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.35" result="edge"/><feGaussianBlur in="edge" stdDeviation="3" result="soft"/><feOffset in="soft" dx="0" dy="5" result="cast"/><feFlood flood-color="#000000" flood-opacity="0.7" result="ink"/><feComposite in="ink" in2="cast" operator="in" result="shadow"/><feFlood flood-color="#000000" result="black"/><feComposite in="black" in2="edge" operator="in" result="outline"/><feMerge><feMergeNode in="shadow"/><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  document.body.append(relief);
  setRenderStatus("loading");
  let titleFitFrame = null;
  function fitTitles() {
    titleFitFrame = null;
    for (const title of cardsRoot.querySelectorAll('.gift-card h2')) {
      if (!title.clientWidth || !title.clientHeight) continue;
      title.style.removeProperty('font-size');
      const maximum = parseFloat(getComputedStyle(title).fontSize) || 23;
      const fits = size => {
        title.style.fontSize = size + 'px';
        return title.scrollWidth <= title.clientWidth && title.scrollHeight <= title.clientHeight;
      };
      if (!fits(maximum)) {
        let low = .25, high = maximum;
        for (let pass = 0; pass < 10; pass++) {
          const size = (low + high) / 2;
          if (fits(size)) low = size; else high = size;
        }
        fits(Math.floor(low * 100) / 100);
      }
      // Approcher les rayons du texte réel, sans éclairer le fond des lettres.
      const textTop = title.offsetTop + (title.firstElementChild?.offsetTop || 0);
      title.parentElement.style.setProperty('--title-black-top', Math.max(0, textTop - 2) + 'px');
    }
    root.dataset.titlesReady = document.fonts?.status === "loading" ? "loading" : "ready";
  }
  function scheduleTitleFit() {
    if (titleFitFrame === null) titleFitFrame = window.requestAnimationFrame ? window.requestAnimationFrame(fitTitles) : setTimeout(fitTitles, 16);
  }
  const cardHits = new Map(), sparkTimers = new Set(), sparkTimersByCard = new Map(), giftQueues = new Map();
  const CARD_GIFT_INTERVAL_MS = 800;
  let seenDeliveries = new WeakMap();
  const MAX_SPARKS = 240, MAX_CARD_SPARKS = 64;
  function clearCardHits() {
    for (const [node, queue] of giftQueues) { clearTimeout(queue.timer); delete node.dataset.pendingGifts; delete node.dataset.giftPulses; }
    giftQueues.clear(); seenDeliveries = new WeakMap();
    clearTimeout(reactionTimer); reaction.classList.remove("visible");
    for (const [node, hit] of cardHits) {
      clearTimeout(hit.timer); node.classList.remove('hit');
      node.querySelector('.card-combo')?.remove();
    }
    cardHits.clear();
    for (const timer of sparkTimers) clearTimeout(timer);
    sparkTimers.clear(); sparkTimersByCard.clear();
    for (const layer of cardsRoot.querySelectorAll('.card-sparks')) layer.remove();
  }
  function highlightCard(node, payload) {
    const now = Date.now(), previous = cardHits.get(node);
    const bounded = value => Math.min(9999, Math.max(1, Math.floor(Number(value) || 1)));
    const received = Math.min(9999, (previous && now - previous.at < 3000 ? previous.received : 0) + bounded(payload.count));
    const total = Math.max(received, bounded(payload.comboCount));
    clearTimeout(previous?.timer);
    const strength = Math.min(5, Math.ceil(Math.log2(total + 1)));
    node.style.setProperty('--hit-strength', String(strength));
    let badge = node.querySelector('.card-combo');
    if (!badge) { badge = document.createElement('span'); badge.className = 'card-combo'; node.append(badge); }
    badge.textContent = '×' + total; badge.hidden = total < 2;
    badge.setAttribute('aria-label', total + ' cadeaux reçus');
    if (!fixed) {
      node.classList.remove('hit'); void node.offsetWidth;
      const oldSparkTimer = sparkTimersByCard.get(node);
      if (oldSparkTimer !== undefined) { clearTimeout(oldSparkTimer); sparkTimers.delete(oldSparkTimer); sparkTimersByCard.delete(node); }
      node.querySelector('.card-sparks')?.remove();
      // Garder des étincelles pour chaque impulsion, même avec douze cartes actives.
      const desired = 8 + strength * 2, existing = [...cardsRoot.querySelectorAll('.card-spark')];
      existing.slice(0, Math.max(0, existing.length + desired - MAX_SPARKS)).forEach(spark => spark.remove());
      let layer = node.querySelector('.card-sparks');
      if (!layer) { layer = document.createElement('span'); layer.className = 'card-sparks'; layer.setAttribute('aria-hidden', 'true'); node.append(layer); }
      const available = Math.min(MAX_CARD_SPARKS - layer.childElementCount, MAX_SPARKS - cardsRoot.querySelectorAll('.card-spark').length);
      const count = Math.max(0, Math.min(available, desired)), sparks = [];
      for (let index = 0; index < count; index++) {
        const spark = document.createElement('i'), angle = Math.PI * 2 * (index / count + Math.random() * .08), distance = 24 + strength * 9 + Math.random() * 24;
        spark.className = 'card-spark';
        spark.style.setProperty('--spark-x', Math.cos(angle) * distance + 'px');
        spark.style.setProperty('--spark-y', Math.sin(angle) * distance + 'px');
        spark.style.setProperty('--spark-delay', Math.round(Math.random() * 100) + 'ms');
        spark.style.setProperty('--spark-size', (3 + Math.random() * 4).toFixed(1) + 'px');
        spark.style.left = (12 + Math.random() * 76) + '%'; spark.style.top = (12 + Math.random() * 76) + '%';
        layer.append(spark); sparks.push(spark);
      }
      if (sparks.length) {
        const timer = setTimeout(() => { sparks.forEach(spark => spark.remove()); sparkTimers.delete(timer); if (sparkTimersByCard.get(node) === timer) sparkTimersByCard.delete(node); if (!layer.childElementCount) layer.remove(); }, CARD_GIFT_INTERVAL_MS);
        sparkTimers.add(timer); sparkTimersByCard.set(node, timer);
      } else if (!layer.childElementCount) layer.remove();
    }
    node.classList.add('hit');
    const hit = {received, total, at:now, timer:setTimeout(() => { node.classList.remove('hit'); node.querySelector('.card-combo')?.remove(); cardHits.delete(node); }, 1700 + strength * 120)};
    cardHits.set(node, hit);
  }
  document.fonts?.ready.then(scheduleTitleFit);
  function resize() {
    scheduleTitleFit();
    const height = customLayout ? 1920 : compact ? Math.max(650, (cardsRoot.scrollHeight || 610) + 40) : Math.max(1920, (cardsRoot.scrollHeight || 0) + 140);
    root.style.height = height + "px";
    if (fitPanel && customLayout) {
      // Studio sources render only the gift area, at its own native resolution.
      // The installer places this panel at the same coordinates as the phone preview.
      const panel=layoutArea.gifts,factor=Math.min(innerWidth/panel.width,innerHeight/panel.height);
      root.style.transform='scale('+factor+')';
      root.style.left=((innerWidth-panel.width*factor)/2-panel.x*factor)+'px';
      root.style.top=((innerHeight-panel.height*factor)/2-panel.y*factor)+'px';
      return;
    }
    if (fitCards && customLayout && cardsRoot.querySelector('.pack-pages')) {
      const pages = cardsRoot.querySelector('.pack-pages'), area = layoutArea.gifts;
      // Retire l’espace réservé à la caméra/au jeu et les marges vides des colonnes.
      // offsetTop/offsetHeight restent en pixels de dessin, quelle que soit la taille du studio.
      const panel = { x: area.x, y: area.y + pages.offsetTop - 14, width: area.width, height: pages.offsetHeight + 28 };
      const factor = Math.min(innerWidth / panel.width, innerHeight / panel.height);
      root.style.transform = "scale(" + factor + ")";
      root.style.left = ((innerWidth - panel.width * factor) / 2 - panel.x * factor) + "px";
      root.style.top = ((innerHeight - panel.height * factor) / 2 - panel.y * factor) + "px";
      return;
    }
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
    const labels=Array.isArray(card.labels)?card.labels:[],linked=labels.some(label=>label.kind==='irl'||label.kind==='action');
    item.classList.toggle('has-linked',linked);item.classList.toggle('linked-only',card.linkedOnly===true);
    const face = document.createElement("div"); face.className = "card-face";
    const rays = document.createElement("span"), foil = document.createElement("span"); rays.className = "card-rays"; foil.className = "card-foil";
    rays.setAttribute("aria-hidden", "true"); foil.setAttribute("aria-hidden", "true");
    const stars = document.createElement("span"); stars.className = "card-stars"; stars.textContent = "★".repeat(level); stars.setAttribute("aria-hidden", "true");
    const category = document.createElement("span"); category.className = "category"; category.textContent = card.linkedOnly ? (labels.some(label=>label.kind==='irl')?'IRL':'ACTION') : { help: "AIDE", neutral: "NEUTRE", trap: "PIÈGE" }[card.column];
    const art = document.createElement("span"); art.className = "art";
    if (['follow','like','likes'].includes(card.triggerType)) art.append(createSocialArt(card.triggerType));
    else art.textContent = '🎁';
    if (card.triggerType === "gift" && /^https:\/\//.test(card.giftImageUrl || "")) {
      const img = document.createElement("img"); img.src = card.giftImageUrl; img.alt = card.giftName || "Cadeau"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.remove(); art.textContent = "🎁"; }, { once: true }); art.replaceChildren(img);
    }
    const title = document.createElement("h2"), titleText = document.createElement("span"); titleText.className = "card-title-text"; if(linked){for(const label of labels){const line=document.createElement('span');line.className='card-action-label '+(label.kind==='game'?['help','neutral','trap'].includes(label.column)?label.column:card.column:'linked');line.textContent=label.text;titleText.append(line);}}
    else titleText.textContent = card.title; title.append(titleText);
    const detail = document.createElement("small"); detail.textContent = card.triggerType === "gift" ? (card.giftCost ? card.giftCost + " ●" : "") : card.triggerType === "follow" ? "FOLLOW" : card.threshold + " LIKES";
    face.append(rays, foil, category, stars, art, title, detail); item.append(face); return item;
  }
  function render(state) {
    state = editorPreview.apply(state?.packs?.[packId] || state);
    const previousProfile = currentProfileId;
    current = valid(state) ? state : null;
    currentProfileId = current?.profileId || "";
    const presentation=current?.presentation||{}, wasFixed=fixed;
    model=[1,2,3].includes(Number(presentation.model))?Number(presentation.model):1;
    fixed=model!==1||(presentation.configured===true?presentation.motion==="fixed":query.get("motion")==="fixed"||(!query.has("motion")&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
    if (fixed && !wasFixed) clearCardHits();
    customLayout=model===1?window.ShenPulseGamePackLayout?.normalize(presentation,packId):null;
    layoutArea=customLayout?window.ShenPulseGamePackLayout.geometry(customLayout):null;pageCapacity=layoutArea?.capacity||PAGE_SIZE;
    const next = JSON.stringify([customLayout,current?.profileId || "", current?.cards || [],model,presentation.backgroundColor||""]);
    if (next === signature) { if (root.getAttribute("aria-busy") !== "true") applyPresentation(); return; }
    signature = next; const revision = ++renderRevision;
    clearCardHits();
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
    const cardPages = window.ShenPulseGamePackLayout.paginateCards(current?.cards || [], pageCapacity, {socialRow:customLayout?.rowOrder==='trap-first'?'trap':'help'});
    pageCount = cardPages.length;
    pageIndex = previousProfile !== current?.profileId ? 0 : Math.min(pageIndex, Math.max(0, pageCount - 1));
    cardsRoot.dataset.pages = String(pageCount);
    if (!pageCount) { cardsRoot.replaceChildren(); cardsRoot.dataset.page = "0"; syncPagination(); resize(); return; }
    const pages = document.createElement("div"); pages.className = "pack-pages";
    for (let index = 0; index < pageCount; index++) {
      const page = document.createElement("section"); page.className = "pack-page"; page.dataset.pageIndex = String(index);
      page.setAttribute("aria-label", "Page " + (index + 1) + " sur " + pageCount);
      for (const [rowName, entries] of Object.entries(cardPages[index])) {
        const row = document.createElement("section"); row.className = "pack-row " + rowName;
        row.setAttribute("aria-label", rowName === "help" ? "Aides et neutres" : "Pièges et neutres");
        entries.forEach((card, slot) => row.append(createCard(card, slot, rowName)));
        page.append(row);
      }
      pages.append(page);
    }
    pages.append(createBrand()); cardsRoot.replaceChildren(pages);
    showPage(pageIndex); syncPagination(previousProfile !== current?.profileId); resize();
  }
  function playCardGift(node, payload, title) {
    const targetPage = Number(node.closest('.pack-page')?.dataset.pageIndex);
    if (Number.isInteger(targetPage) && targetPage !== pageIndex) { showPage(targetPage); syncPagination(true); }
    highlightCard(node, payload);
    node.dataset.giftPulses = String((Number(node.dataset.giftPulses) || 0) + 1);
    reaction.textContent = (payload.viewer || 'Viewer') + ' · ' + title;
    reaction.classList.add('visible'); clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => reaction.classList.remove('visible'), 4500);
  }
  function enqueueCardGifts(node, payload, title) {
    // count est la quantité de cette livraison ; comboCount reste une indication visuelle.
    // Un total de 20 transmis avec chacune des 20 unités ne doit jamais produire 400 animations.
    const count = Math.min(9999, Math.max(1, Math.floor(Number(payload.count) || 1)));
    const gift = {...payload, count:1, comboCount:Math.max(count, Number(payload.comboCount) || 1)};
    let queue = giftQueues.get(node);
    if (!queue) { queue = {segments:[], pending:0, timer:null}; giftQueues.set(node, queue); }
    const previous = queue.segments.at(-1);
    if (previous && previous.payload.viewer === gift.viewer && previous.payload.comboCount === gift.comboCount) previous.remaining += count;
    else queue.segments.push({payload:gift, title, remaining:count});
    queue.pending += count; node.dataset.pendingGifts = String(queue.pending);
    if (queue.timer !== null) return;
    const next = () => {
      if (giftQueues.get(node) !== queue) return;
      const segment = queue.segments[0];
      if (!segment || !node.isConnected) { giftQueues.delete(node); delete node.dataset.pendingGifts; return; }
      segment.remaining--; queue.pending--; node.dataset.pendingGifts = String(queue.pending);
      playCardGift(node, segment.payload, segment.title);
      if (!segment.remaining) queue.segments.shift();
      queue.timer = setTimeout(next, CARD_GIFT_INTERVAL_MS);
    };
    next();
  }
  function trigger(payload) {
    if (model!==1 || !current || payload.profileId !== current.profileId || payload.packId !== packId) return;
    const card = current.cards.find(item => item.id === payload.ruleId || item.ruleIds?.includes(payload.ruleId)); if (!card) return;
    const node = [...cardsRoot.querySelectorAll('.gift-card')].find(item => item.dataset.rule === card.id);
    if(node&&payload.eventKey){let seen=seenDeliveries.get(node);if(!seen){seen=new Set();seenDeliveries.set(node,seen);}const key=String(payload.eventKey);if(seen.has(key))return;seen.add(key);if(seen.size>1024)seen.delete(seen.values().next().value);}
    if (node) enqueueCardGifts(node, payload, card.title);
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
  addEventListener("pagehide", () => { editorPreview.dispose(); clearCardHits(); if (titleFitFrame !== null) { if (window.cancelAnimationFrame) window.cancelAnimationFrame(titleFitFrame); else clearTimeout(titleFitFrame); } source?.close(); clearTimeout(retry); clearInterval(poll); clearInterval(pageTimer); clearTimeout(reactionTimer); });
  // Read-only browser source: it never dispatches game effects or starts a LIVE.
  window.ShenPulseGamePack = { render, trigger };
  resize(); if (query.get("channel")) connectPublic(); else if (query.get("token")) connectLocal();
})();
