-- ShenPulse Game Pass adapter. Uses the installed game's own GDK engine and saves.
local json = assert(love.filesystem.load('shenpulse/json.lua'))()
local config = json.decode(assert(love.filesystem.read('shenpulse/channel/config.json')))
assert(type(config.token) == 'string' and #config.token == 64, 'Invalid ShenPulse configuration')
local allowed = {}
for _, code in ipairs(config.codes) do allowed[code] = true end

-- The public Balamod implementation uses base-game APIs. Its globals stay in
-- this private environment; LuaSocket and the Balamod loader are not needed.
local env = setmetatable({}, {__index = _G})
env._G = env
env.string = setmetatable({}, {__index = string})
env.require = function(name)
    if name == 'socket' then return {} end
    return require(name)
end
local effects = assert(love.filesystem.load('shenpulse/effects.lua'))
setfenv(effects, env)
effects()
env.ease_discard = env.ease_discards -- spelling in the public Balamod pack

-- Une main vidée par un effet doit pouvoir recevoir des cartes à nouveau.
local function draw_from(area, amount)
    amount = tonumber(amount) or 1
    if not G.hand or not area or #area.cards < amount then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.1, func = function()
        for i = 1, amount do
            local card = area.cards[#area.cards]
            if card then draw_card(area, G.hand, i * 100 / amount, 'up', false, card) end
        end
        return true
    end}))
    return true
end
env.drawFromDeck = function(amount) return draw_from(G.deck, amount) end
env.drawFromDiscard = function(amount) return draw_from(G.discard, amount) end

local function read_file(name)
    local f = io.open(config.directory .. '/' .. name, 'rb')
    if not f then return nil end
    local text = f:read(65537)
    f:close()
    if not text or #text > 65536 then return nil end
    local ok, value = pcall(json.decode, text)
    return ok and value or nil
end

local function write_file(name, value)
    local f = io.open(config.directory .. '/' .. name .. '.tmp', 'wb')
    if not f then return end
    f:write(json.encode(value))
    f:close()
    os.remove(config.directory .. '/' .. name)
    os.rename(config.directory .. '/' .. name .. '.tmp', config.directory .. '/' .. name)
end

local function snapshot()
    return {
        dollars = G.GAME and G.GAME.dollars,
        chips = G.GAME and G.GAME.chips,
        hands = G.GAME and G.GAME.current_round and G.GAME.current_round.hands_left,
        discards = G.GAME and G.GAME.current_round and G.GAME.current_round.discards_left,
        cards = G.hand and #G.hand.cards or 0,
        jokers = G.jokers and #G.jokers.cards or 0,
        consumables = G.consumeables and #G.consumeables.cards or 0,
        state = G.STATE
    }
end

local function ready()
    return G and G.GAME and G.hand
        and G.STATE == G.STATES.SELECTING_HAND and not G.screenwipe
end

local function execute(request)
    if type(request.expiresAt) ~= 'number' or os.time() * 1000 > request.expiresAt then return 3, 'La demande a expiré.' end
    if not allowed[request.code] then return 2, 'Interaction Balatro inconnue.' end
    if not ready() then return 3, 'Choisissez une mise et attendez la sélection des cartes.' end
    local code = request.code
    local target, collection
    if code:sub(1, 6) == 'crand_' then
        collection = G.consumeables.cards
        code = code:sub(7)
    elseif code:sub(1, 6) == 'jrand_' then
        collection = G.jokers.cards
        code = code:sub(7)
    elseif code:sub(1, 5) == 'rand_' then
        collection = G.hand.cards
        code = code:sub(6)
    end
    if collection then
        if #collection == 0 then return 3, 'Aucune carte compatible disponible.' end
        target = math.random(#collection)
    end
    local method, argument = code:match('^([^_]+)_(.+)$')
    method = method or code
    if type(env[method]) ~= 'function' then return 2, 'Cette interaction n’est pas installée.' end
    local result
    local attempts = collection and math.min(#collection, 8) or 1
    for _ = 1, attempts do
        if argument then result = env[method](argument, target)
        else result = env[method](target) end
        if result == true then break end
        if collection then target = target % #collection + 1 end
    end
    if result ~= true then return 3, 'Les cartes ou ressources nécessaires ne sont pas disponibles.' end
    return 0, ''
end

local previous_update = Game.update
local last_id, last_response, next_poll, next_heartbeat = nil, nil, 0, 0
function Game:update(dt)
    local result = previous_update(self, dt)
    local now = love.timer.getTime()
    if now < next_poll then return result end
    next_poll = now + 0.03
    if env.hidden and G.hand then
        local visible = G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP
            or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU
        G.hand.states.visible = visible
        if visible then env.hidden = false end
    end
    if now >= next_heartbeat then
        next_heartbeat = now + 1
        write_file('ready.json', { token = config.token, at = os.time(), ready = ready() and true or false, metadata = snapshot() })
    end
    local request = read_file('request.json')
    if not request or request.token ~= config.token or type(request.id) ~= 'string' then return result end
    if request.id == last_id then return result end
    last_id = request.id
    local ok, status, message = pcall(execute, request)
    last_response = { id = request.id, token = config.token, status = ok and status or 1,
        message = ok and message or 'Le module Balatro a refusé cet effet.', metadata = snapshot() }
    write_file('response.json', last_response)
    return result
end
