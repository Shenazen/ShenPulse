-- Local ShenPulse TCP transport; gameplay functions remain those of the CC mod.
local CC = SMODS.current_mod
local socket = require('socket')
local json = assert(SMODS.load_file('json.lua'))()
local allowed = assert(SMODS.load_file('allowed.lua'))()
local client, buffer, outgoing, reconnect_at = nil, '', '', 0
local function disconnect()
    if client then client:close() end
    client, buffer, outgoing = nil, '', ''
end
local function execute(request)
    if request.type ~= 1 then return nil end
    local response = { id = request.id, status = 3, message = '' }
    if not allowed[request.code] then response.status = 2; return response end
    if not CC.util.isReady() then return response end
    local method, collection = request.code, nil
    if method:sub(1, 6) == 'crand_' then collection = G.consumeables.cards; method = method:sub(7)
    elseif method:sub(1, 6) == 'jrand_' then collection = G.jokers.cards; method = method:sub(7)
    elseif method:sub(1, 5) == 'rand_' then collection = G.hand.cards; method = method:sub(6) end
    if collection and #collection == 0 then return response end
    local argument
    local name, suffix = method:match('^([^_]+)_(.+)$')
    if name then method, argument = name, suffix end
    if type(CC.FUNCS[method]) ~= 'function' then response.status = 2; return response end
    local ok, success = pcall(CC.FUNCS[method], collection and pseudorandom_element(collection, pseudoseed('shenpulse')) or nil, argument)
    response.status = ok and (success and 0 or 3) or 1
    return response
end
local previous = Game.update
function Game:update(dt)
    local result = previous(self, dt)
    if CC.hidden and G.hand then
        local visible = G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU
        G.hand.states.visible = visible
        if visible then CC.hidden = false end
    end
    local now = socket.gettime()
    if not client and now >= reconnect_at then
        reconnect_at = now + 2
        client = socket.tcp()
        client:settimeout(0.05)
        local connected = client:connect('127.0.0.1', 58437)
        if not connected then disconnect()
        else client:settimeout(0); client:setoption('tcp-nodelay', true) end
    end
    if not client then return result end
    local received, err, partial = client:receive(4096)
    buffer = buffer .. (received or partial or '')
    if #buffer > 65536 then disconnect(); return result end
    for _ = 1, 8 do
        local ending = buffer:find('\0', 1, true)
        if not ending then break end
        local text = buffer:sub(1, ending - 1)
        buffer = buffer:sub(ending + 1)
        local ok, request = pcall(json.decode, text)
        if ok and type(request) == 'table' then
            local response = execute(request)
            if response then outgoing = outgoing .. json.encode(response) .. '\0' end
        end
    end
    if #outgoing > 0 then
        local sent, send_error, last = client:send(outgoing)
        outgoing = outgoing:sub((sent or last or 0) + 1)
        if send_error == 'closed' then disconnect() end
    end
    if err == 'closed' then disconnect() end
    return result
end
