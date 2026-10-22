if (sendDebugMessage == nil) then
    sendDebugMessage = function(_)
    end
end

local socket = require("socket")
client = nil
announce = false
hidden = false


local function on_enable()
    client =  socket.tcp()
    client:settimeout(0)
    client:setoption('keepalive',true)
    client:setoption('tcp-nodelay',true)
    client:connect("127.0.0.1", 58430)
    announce = false


end

local function on_disable()
    if client then
        client:close()
        client = nil
    end
    announce = true
end

local function on_pre_update()
    if hidden then
        if G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU then
            hidden = false
            G.hand.states.visible = true
        else
            G.hand.states.visible = false
        end
    end


    if not announce and client and not G.screenwipe then

        local status = client:getpeername()
        if status == nil then return end



        if G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU then
            announce = true

    
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
                G.FUNCS.wipe_on( { "Crowd Control Connected" },true)
    
                G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.75,func = function()
                    G.FUNCS.wipe_off()
                return true end }))
            return true end }))


    
            return
        end
    end

    if client then
        parseMessages()
    end
end


local function on_key_pressed(key_name)
    if (key_name == "down") then
        --G.hand.states.visible = false
    end
    if (key_name == "up") then
        --G.hand.states.visible = true
    end            
end

local suffixes = {
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'T',
    'J',
    'Q',
    'K',
    'A'
}

local suits = {
    'Hearts',
    'Diamonds',
    'Clubs',
    'Spades'
}

local seals = {
    "BASE",
    "Red",
    "Blue",
    "Gold",
    "Purple"
}

local editions = {
    "BASE",
    "Foil",
    "Holo",
    "Polychrome"
    --{foil = true},
    --{holo = true},
    --{polychrome = true}
}

function GetSeals()
    return seals
end

function GetSuits()
    return suits
end

function GetEditions()
    return editions
end

function getMaterialCenters()
    local materials = {
        "BASE",
        G.P_CENTERS.m_stone,
        G.P_CENTERS.m_steel,
        G.P_CENTERS.m_glass,
        G.P_CENTERS.m_gold,
        G.P_CENTERS.m_bonus,
        G.P_CENTERS.m_mult,
        G.P_CENTERS.m_wild,
        G.P_CENTERS.m_lucky
    }
    return materials
end

-- TODO
local Custom_Suits = {}
local Custom_Ranks = {}

local MAX_RANK = 14
local MIN_RANK = 2

-- get values from cards

function GetCardRank(card)
    return card.base.id
end

function GetCardSuit(card)
    return card.base.suit
end

function GetCardSeal(card)
    return card.seal
end

-- functional methods

function GetSuffixFromRank(rank)
    if (suffixes[rank + 1 - MIN_RANK] ~= nil) then
        return suffixes[rank + 1 - MIN_RANK]
    end
    return '-1'
end

function GetCardCenter(card)
    return card.config.center
end

function GetCardEdition(card)
    --return card.edition
    if (card.edition == nil) then
        return "BASE"
    end
    if (card.edition.foil) then
        return "Foil"
    end
    if (card.edition.holo) then
        return "Holo"
    end
    if (card.edition.polychrome) then
        return "Polychrome"
    end
end

function ChangeCardCenter(card, center)
    card:set_ability(center)
end

function ChangeCardSeal(card, seal)
    card:set_seal(seal, true, true)
end

function ChangeCardEdition(card, edition)
    if (edition == "BASE") then
        card:set_edition(nil, true, true)
    end
    if (edition == "Foil") then
        card:set_edition({foil = true}, true, true)
    end
    if (edition == "Holo") then
        card:set_edition({holo = true}, true, true)
    end
    if (edition == "Polychrome") then
        card:set_edition({polychrome = true}, true, true)
    end
end

function ResetCardCenter(card)
    card:set_ability(G.P_CENTERS.c_base)
end

function ResetCardSeal(card)
    card:set_seal(nil, true, true)
end

function ResetCardEdition(card)
    card:set_edition(nil, true, true)
end

function GetNominalFromRank(rank)
    if (rank <= 9) then
        return rank
    end
    if (rank < 14) then
        return 10
    end
    return 11
end

function ChangeCardRank(card, rank_suffix)
    local suit_prefix = string.sub(card.base.suit, 1, 1)..'_'
    rank_suffix = GetSuffixFromRank(NormalizeRank(rank_suffix))
    card:set_base(G.P_CARDS[suit_prefix..rank_suffix])
end

function NormalizeRank(rank)
    local range = MAX_RANK - MIN_RANK + 1
    return ((rank - MIN_RANK) % range) + MIN_RANK
end

function ChangeCardSuit(card, suit)
    local rank = GetCardRank(card)
    local suit_prefix = string.sub(suit, 1, 1)..'_'
    local rank_suffix = GetSuffixFromRank(rank)
    card:set_base(G.P_CARDS[suit_prefix..rank_suffix])
end

function AddNewRank(name, suffix)

end

function AddNewSuit(name, prefix)
    for i = MIN_RANK, MAX_RANK do
        local suffix = GetSuffixFromRank(NormalizeRank(i))
        local p_card_obj = {
            name = suffix .. " of " .. name,
            value = suffix,
            suit = name,
            pos = {x = i - 2, y = #Custom_Suits + 4}
        }
        G.P_CARDS[prefix.."_"..suffix] = p_card_obj
    end
end

function SetMaxRank(rank)
    MAX_RANK = rank
end

function SetMinRank(rank)
    MIN_RANK = rank
end

-- helper

function Clamp(min, max, num)
    return math.max(min, math.min(max, num))
end

function addFaceCard()
    local suit = ""
    local s = math.random(4)

    if s == 1 then suit = "D" end
    if s == 2 then suit = "C" end
    if s == 3 then suit = "H" end
    if s == 4 then suit = "S" end

    local val = ""
    s = math.random(3)

    if s == 1 then val = "J" end
    if s == 2 then val = "Q" end
    if s == 3 then val = "K" end

    local type = G.P_CARDS[suit.."_"..val]

    return addToHand(type)
end

function addNumberCard()
    local suit = ""
    local s = math.random(4)

    if s == 1 then suit = "D" end
    if s == 2 then suit = "C" end
    if s == 3 then suit = "H" end
    if s == 4 then suit = "S" end

    local val = ""
    s = math.random(10)

    if s == 1 then val = "A" end
    if s == 2 then val = "2" end
    if s == 3 then val = "3" end
    if s == 4 then val = "4" end
    if s == 5 then val = "5" end
    if s == 6 then val = "6" end
    if s == 7 then val = "7" end
    if s == 8 then val = "8" end
    if s == 9 then val = "9" end
    if s == 10 then val = "T" end

    local type = G.P_CARDS[suit.."_"..val]

    return addToHand(type)
end

function addToHand(value)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = Card(G.play.T.x + G.play.T.w/2, G.play.T.y, G.CARD_W, G.CARD_H, value, G.P_CENTERS.c_base, {playing_card = #G.playing_cards+1})
        G.hand.cards[#G.hand.cards+1] = card
        G.playing_cards[#G.playing_cards+1] = card

        card:set_card_area(G.hand)
        G.hand:set_ranks()
        G.hand:align_cards()
    return true end }))
    return true
end

function openBooster(centertxt)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if opening then return false end


    local center = G.P_CENTERS[centertxt]
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = Card(G.play.T.x + G.play.T.w/2, G.play.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.S_A, center, nil)

        if centertxt:find("buffoon") then
            hidden = true
            G.hand.states.visible = false
        end

        card.cost = 0

        --card:open()
        use_card(card)
    return true end }))
    return true
end

function cycleHand(value, target)
    value = tonumber(value)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local rank = GetCardRank(G.hand.cards[i])
                ChangeCardRank(G.hand.cards[i], NormalizeRank(rank + value))
            end
        end

    return true end }))
    return true
end

function debuffHand(value, target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if value == "true" then value = true end
    if value == "false" then value = false end

    if target ~= nil then
        local state = G.hand.cards[target].debuff
        if value == state then return false end
    end


    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                G.hand.cards[i].debuff = value
            end
        end

    return true end }))
    return true
end


function boostHand(value, target)
    value = tonumber(value)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if target ~= nil then
        local rank = GetCardRank(G.hand.cards[target])
        if value > 0 and rank == 14 then return false end
        if value < 0 and rank == 2 then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local rank = GetCardRank(G.hand.cards[i])
                rank = rank + value
                if rank < 2 then rank = 2 end
                if rank > 14 then rank = 14 end
                ChangeCardRank(G.hand.cards[i], rank)
            end
        end

    return true end }))
    return true
end

function setHandSuit(value, target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if target ~= nil then
        local currentSuit = GetCardSuit(G.hand.cards[target])
        currentSuit = string.sub(currentSuit, 1, 1)
        targetSuit = string.sub(value, 1, 1)

        if currentSuit == targetSuit then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                ChangeCardSuit(G.hand.cards[i], value)
            end
        end

    return true end }))
    return true
end

function cycleHandSuit(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        suits = GetSuits()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local currentSuit = GetCardSuit(G.hand.cards[i])
                local currentIndex = 1
                for j=1, #suits do
                    if (suits[j] == currentSuit) then
                        currentIndex = j
                    end
                end
                local nextIndex = currentIndex + 1
                if (nextIndex > #suits) then
                    nextIndex = 1
                end
                if (nextIndex < 1) then
                    nextIndex = #suits
                end
                ChangeCardSuit(G.hand.cards[i], suits[nextIndex])
            end
        end

    return true end }))
    return true
end

function destroyHand(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.hand.cards, 1, -1 do
                if target == nil or i == target then
                    local card = G.hand.cards[i]
                    if card.ability.name == 'Glass Card' then 
                        card:shatter()
                    else
                        card:start_dissolve(nil, i == #G.hand.cards)
                    end
                end
            end
    return true end }))
    return true
end

function destroyDeck()
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.deck.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 

        local card = G.deck.cards[1]
        if card.ability.name == 'Glass Card' then 
            card:shatter()
        else
            card:start_dissolve(nil, i == #G.hand.cards)
        end

    return true end }))
    return true
end

function discardHand(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.hand.cards, 1, -1 do
                if target == nil or i == target then
                    local card = G.hand.cards[i]

                    card:calculate_seal({discard = true})
                    local removed = false
                    for j = 1, #G.jokers.cards do
                        local eval = nil
                        eval = G.jokers.cards[j]:calculate_joker({discard = true, other_card =  card, full_hand = G.hand})
                        if eval then
                            if eval.remove then removed = true end
                            card_eval_status_text(G.jokers.cards[j], 'jokers', nil, 1, nil, eval)
                        end
                    end

                    draw_card(G.hand, G.discard, i*100/#G.hand.cards, 'down', false, card)          
                end     
            end
    return true end }))
    return true
end

function reshuffle()
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.discard.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.discard.cards, 1, -1 do
                local card = G.discard.cards[i]
                draw_card(G.discard, G.deck, i*100/#G.discard.cards, 'down', false, card)            
            end
            G.deck:shuffle()
    return true end }))
    return true
end

function drawFromDiscard(total)
    total = tonumber(total)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.discard.cards < total) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            local num = 0
            for i=#G.discard.cards, 1, -1 do
                local card = G.discard.cards[i]
                draw_card(G.discard, G.hand, i*100/#G.discard.cards, 'up', false, card)            
                num = num + 1
                if total ~= nil and num >= total then break end
            end
    return true end }))
    return true
end

function drawFromDeck(total)
    total = tonumber(total)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.deck.cards < total) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            local num = 0
            for i=#G.deck.cards, 1, -1 do
                local card = G.deck.cards[i]
                draw_card(G.deck, G.hand, i*100/#G.deck.cards, 'up', false, card)            
                num = num + 1
                if total ~= nil and num >= total then break end
            end
    return true end }))
    return true
end

function flipHand(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local card = G.hand.cards[i]
                card:flip()
            end
        end

    return true end }))
    return true
end

function changeHandEdition(edition, target)
    if seal == "BASE" then seal = nil end
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if target ~= nil then
        local card = G.hand.cards[target]
        local cur = GetCardEdition(card)
        if cur == edition then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local card = G.hand.cards[i]
                ChangeCardEdition(card, edition)
            end
        end

    return true end }))
    return true
end

function changeJokerEdition(edition, target)
    if seal == "BASE" then seal = nil end
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.jokers.cards < 1) then return false end

    if target ~= nil then
        local card = G.jokers.cards[target]
        local cur = GetCardEdition(card)
        if cur == edition then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.jokers.cards do
            if target == nil or i == target then
                local card = G.jokers.cards[i]
                ChangeCardEdition(card, edition)
            end
        end

    return true end }))
    return true
end

function changeHandSeal(seal, target)
    if seal == "BASE" then seal = nil end
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if target ~= nil then
        local card = G.hand.cards[target]
        local cur = GetCardSeal(card)
        if cur == seal then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local card = G.hand.cards[i]
                ChangeCardSeal(card, seal)
            end
        end

    return true end }))
    return true
end

function changeHandCenter(center, target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    center = G.P_CENTERS[center]    

    if target ~= nil then
        local card = G.hand.cards[target]
        local cur = GetCardCenter(card)
        if cur == center then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local card = G.hand.cards[i]
                ChangeCardCenter(card, center)
            end
        end

    return true end }))
    return true
end

function addMoney(money)
    money = tonumber(money)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if money < 0 and G.GAME.dollars < -1*money then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        --G.GAME.dollars = G.GAME.dollars + money
        ease_dollars(money)
    return true end }))
    return true
end

function addHands(value)
    value = tonumber(value)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if value < 0 and G.GAME.current_round.hands_left < -1*value+1 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        --G.GAME.current_round.hands_left = G.GAME.current_round.hands_left + value
        ease_hands(value)
    return true end }))
    return true
end

function addDiscards(value)
    value = tonumber(value)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if value < 0 and G.GAME.current_round.discards_left < -1*value then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        --G.GAME.current_round.discards_left = G.GAME.current_round.discards_left + value
        ease_discard(value)
    return true end }))
    return true
end


function addChips(value)
    value = tonumber(value)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end

    if value == 0 then
        value = G.GAME.chips * -1
    else
        value = G.GAME.blind.chips * value
        value = value / 100
    end

    if value < 0 and G.GAME.chips < -1*value then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        ease_chipsy(value)
    return true end }))
    return true
end

function addBlind(value)
    value = tonumber(value)
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end


    value = G.GAME.blind.chips * value
    value = value / 100

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()

        G.GAME.blind.chips = G.GAME.blind.chips + value
        G.GAME.blind.chip_text = number_format(G.GAME.blind.chips)

        G.HUD_blind:recalculate(false)

        local chip_UI = G.HUD_blind:get_UIE_by_ID('HUD_blind_count')
        chip_UI:juice_up()
        play_sound('chips2')


    return true end }))
    return true
end

function addTarot()
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = create_card('Tarot',G.consumeables, nil, nil, nil, nil, nil, 'car')
        card:add_to_deck()
        G.consumeables:emplace(card)
    return true end }))
    return true
end

function addPlanet()
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = create_card('Planet',G.consumeables, nil, nil, nil, nil, nil, 'car')
        card:add_to_deck()
        G.consumeables:emplace(card)
    return true end }))
    return true
end

function addSpectral()
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = create_card('Spectral',G.consumeables, nil, nil, nil, nil, nil, 'car')
        card:add_to_deck()
        G.consumeables:emplace(card)
    return true end }))
    return true
end

function addJoker()
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = create_card('Joker',G.jokers, nil, nil, nil, nil, nil, 'car')
        card:add_to_deck()
        G.jokers:emplace(card)
        card:start_materialize()
    return true end }))
    return true
end

function destroyJokers(target)
    if target~=nil then target = tonumber(target) end
    if (G.jokers == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.jokers.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.jokers.cards, 1, -1 do
                if target == nil or i == target then
                    local card = G.jokers.cards[i]
                    if card.ability.name == 'Glass Card' then 
                        card:shatter()
                    else
                        card:start_dissolve(nil, i == #G.jokers.cards)
                    end
                end
            end
    return true end }))
    return true
end

function destroyConsumables(target)
    if target~=nil then target = tonumber(target) end
    if (G.consumeables == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    if (#G.consumeables.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.consumeables.cards, 1, -1 do
                if target == nil or i == target then
                    local card = G.consumeables.cards[i]
                    if card.ability.name == 'Glass Card' then 
                        card:shatter()
                    else
                        card:start_dissolve(nil, i == #G.consumeables.cards)
                    end
                end
            end
    return true end }))
    return true
end

function randomizeHand(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local s = math.random(4)
                local suit = ""

                if s == 1 then suit = "Diamonds" end
                if s == 2 then suit = "Clubs" end
                if s == 3 then suit = "Hearts" end
                if s == 4 then suit = "Spades" end

                local value = math.random(14)

                ChangeCardSuit(G.hand.cards[i], suit)
                ChangeCardRank(G.hand.cards[i], NormalizeRank(value))
            end
        end

    return true end }))
    return true
end

function randomizeValue(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local value = math.random(14)

                ChangeCardRank(G.hand.cards[i], NormalizeRank(value))
            end
        end

    return true end }))
    return true
end

function randomizeSuit(target)
    if target~=nil then target = tonumber(target) end
    if (G.hand == nil) then return false end
    if (#G.hand.cards < 1) then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #G.hand.cards do
            if target == nil or i == target then
                local s = math.random(4)
                local suit = ""

                if s == 1 then suit = "Diamonds" end
                if s == 2 then suit = "Clubs" end
                if s == 3 then suit = "Hearts" end
                if s == 4 then suit = "Spades" end
                
                ChangeCardSuit(G.hand.cards[i], suit)
            end
        end

    return true end }))
    return true
end

function ease_chipsy(mod)
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            local chip_UI = G.HUD:get_UIE_by_ID('chip_UI_count')

            mod = mod or 0

            --Ease from current chips to the new number of chips
            G.E_MANAGER:add_event(Event({
                trigger = 'ease',
                blockable = false,
                ref_table = G.GAME,
                ref_value = 'chips',
                ease_to = G.GAME.chips + mod,
                delay =  0.1,
                func = (function(t) 
                    return math.floor(t)
                end)
            }))

            --Popup text next to the chips in UI showing number of chips gained/lost
                chip_UI:juice_up()
            --Play a chip sound
            play_sound('chips2')
            return true
        end
      }))
end

function ease_blind(mod)
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            local chip_UI = G.HUD_blind:get_UIE_by_ID('HUD_blind_count')

            mod = mod or 0

            --Ease from current chips to the new number of chips
            G.E_MANAGER:add_event(Event({
                trigger = 'ease',
                blockable = false,
                ref_table = G.GAME.blind,
                ref_value = 'chips',
                ease_to = G.GAME.blind.chips + mod,
                delay =  0.1,
                func = (function(t) 
                    return math.floor(t)
                end)
            }))

            --Popup text next to the chips in UI showing number of chips gained/lost
                chip_UI:juice_up()
            --Play a chip sound
            play_sound('chips2')
            return true
        end
      }))
end

function ease_dollars(mod, instant)
    local function _mod(mod)
        local dollar_UI = G.HUD:get_UIE_by_ID('dollar_text_UI')
        mod = mod or 0
        local text = '+'..localize('$')
        local col = G.C.MONEY
        if mod < 0 then
            text = '-'..localize('$')
            col = G.C.RED              
        else
          inc_career_stat('c_dollars_earned', mod)
        end
        --Ease from current chips to the new number of chips
        G.GAME.dollars = G.GAME.dollars + mod
        check_and_set_high_score('most_money', G.GAME.dollars)
        check_for_unlock({type = 'money'})
        dollar_UI.config.object:update()
        G.HUD:recalculate()
        --Popup text next to the chips in UI showing number of chips gained/lost
        attention_text({
          text = text..tostring(math.abs(mod)),
          scale = 0.8, 
          hold = 0.7,
          cover = dollar_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        play_sound('coin1')
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end

function ease_discards(mod, instant, silent)
    local _mod = function(mod)
        if math.abs(math.max(G.GAME.current_round.discards_left, mod)) == 0 then return end
        local discard_UI = G.HUD:get_UIE_by_ID('discard_UI_count')
        mod = mod or 0
        mod = math.max(-G.GAME.current_round.discards_left, mod)
        local text = '+'
        local col = G.C.GREEN
        if mod < 0 then
            text = ''
            col = G.C.RED
        end
        --Ease from current chips to the new number of chips
        G.GAME.current_round.discards_left = G.GAME.current_round.discards_left + mod
        --Popup text next to the chips in UI showing number of chips gained/lost
        discard_UI.config.object:update()
        G.HUD:recalculate()
        attention_text({
          text = text..mod,
          scale = 0.8, 
          hold = 0.7,
          cover = discard_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        if not silent then play_sound('chips2') end
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end


function ease_hands(mod, instant)
    local _mod = function(mod)
        local hand_UI = G.HUD:get_UIE_by_ID('hand_UI_count')
        mod = mod or 0
        local text = '+'
        local col = G.C.GREEN
        if mod < 0 then
            text = ''
            col = G.C.RED
        end
        --Ease from current chips to the new number of chips
        G.GAME.current_round.hands_left = G.GAME.current_round.hands_left + mod
        hand_UI.config.object:update()
        G.HUD:recalculate()
        --Popup text next to the chips in UI showing number of chips gained/lost
        attention_text({
          text = text..mod,
          scale = 0.8, 
          hold = 0.7,
          cover = hand_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        play_sound('chips2')
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end


responseCode = {
    -- Worked
    success = 0,
    -- Failed and refund but is available
    failure = 1,
    -- Failed and unavailable
    unavailable = 2,
    -- Try again later
    retry = 3
}

local json = { _version = "0.1.2" }

function isReady()

    if G.screenwipe then return false end

    if G.STATE == G.STATES.SELECTING_HAND then

    else
        return false
    end

    return true
end

function string:split(pPattern)
    local Table = {}  -- NOTE: use {n = 0} in Lua-5.0
    local fpat = "(.-)" .. pPattern
    local last_end = 1
    local s, e, cap = self:find(fpat, 1)
    while s do
       if s ~= 1 or cap ~= "" then
      table.insert(Table,cap)
       end
       last_end = e+1
       s, e, cap = self:find(fpat, last_end)
    end
    if last_end <= #self then
       cap = self:sub(last_end)
       table.insert(Table, cap)
    end
    return Table
 end

function parseMessages()
    local response = {
        id = nil,
        status = nil,
        message = nil,
    }
    local message, status, partial =  client:receive()

    if  partial ~= nil and string.len(partial) >0  then

        if string.match(partial, "\"viewers\":") then
            local items = string.split(partial,"\"viewers\":")
            local temp = items[1]
            local temp2 = items[2]
            items = string.split(temp2, "],")
            partial = temp .. items[2]
        end


        --error(partial)

        partialAsTable = json.decode(partial)
        local method = partialAsTable["code"]

        response["id"] = partialAsTable["id"]

        if not isReady() then
            response["status"] = responseCode.retry
            response["message"] = ""
        else
            local arg = nil
            local target = nil
            local alttype = false
            if method ~= nil then
                if string.match(method, "crand_") then
                    local items = string.split(method,"crand_")
                    method = items[1]
                    target = math.random(#G.consumeables.cards)
                    alttype = true
                end
                if string.match(method, "jrand_") then
                    local items = string.split(method,"jrand_")
                    method = items[1]
                    target = math.random(#G.jokers.cards)
                    alttype = true
                end                
                if string.match(method, "rand_") then
                    local items = string.split(method,"rand_")
                    method = items[1]
                    target = math.random(#G.hand.cards)
                end                

                if string.match(method, "_") then
                    local items = string.split(method,"_")
                    method = items[1]
                    arg = items[2]

                    if #items > 2 then
                        arg = arg .. "_" .. items[3]
                    end
                    if #items > 3 then
                        arg = arg .. "_" .. items[4]
                    end      
                    if #items > 4 then
                        arg = arg .. "_" .. items[5]
                    end                                      
                end
            end

            if method ~= nil and _G[method]~=nil then 
                local status
                if arg ~= nil then
                    status = _G[method](arg, target)
                else
                    status = _G[method](target)
                end

                if target ~= nil and status == false and not alttype then
                    target = math.random(#G.hand.cards)
                    if arg ~= nil then
                        status = _G[method](arg, target)
                    else
                        status = _G[method](target)
                    end

                    if status == false then 
                        target = math.random(#G.hand.cards)
                        if arg ~= nil then
                            status = _G[method](arg, target)
                        else
                            status = _G[method](target)
                        end

                        if status == false then 
                            target = math.random(#G.hand.cards)
                            if arg ~= nil then
                                status = _G[method](arg, target)
                            else
                                status = _G[method](target)
                            end
                            
                            if status == false then 
                                target = math.random(#G.hand.cards)
                                if arg ~= nil then
                                    status = _G[method](arg, target)
                                else
                                    status = _G[method](target)
                                end
                            end
                        end

                    end
                end

                if status == false then status = responseCode.retry end
                if status == true then status = responseCode.success end

                response["status"] = status
                response["message"] = ""
            else
                response["status"] = responseCode.unavailable
                response["message"] = "Requested Method was not found"
            end

        end

        responseAsString = json.encode(response)
        responseAsString = responseAsString .. "\0"	
        local ind, err, last = client:send(responseAsString)
    end
end



-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
  [ "\\" ] = "\\",
  [ "\"" ] = "\"",
  [ "\b" ] = "b",
  [ "\f" ] = "f",
  [ "\n" ] = "n",
  [ "\r" ] = "r",
  [ "\t" ] = "t",
}

local escape_char_map_inv = { [ "/" ] = "/" }
for k, v in pairs(escape_char_map) do
  escape_char_map_inv[v] = k
end


local function escape_char(c)
  return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end


local function encode_nil(val)
  return "null"
end


local function encode_table(val, stack)
  local res = {}
  stack = stack or {}

  -- Circular reference?
  if stack[val] then error("circular reference") end

  stack[val] = true

  if rawget(val, 1) ~= nil or next(val) == nil then
    -- Treat as array -- check keys are valid and it is not sparse
    local n = 0
    for k in pairs(val) do
      if type(k) ~= "number" then
        error("invalid table: mixed or invalid key types")
      end
      n = n + 1
    end
    if n ~= #val then
      error("invalid table: sparse array")
    end
    -- Encode
    for i, v in ipairs(val) do
      table.insert(res, encode(v, stack))
    end
    stack[val] = nil
    return "[" .. table.concat(res, ",") .. "]"

  else
    -- Treat as an object
    for k, v in pairs(val) do
      if type(k) ~= "string" then
        error("invalid table: mixed or invalid key types")
      end
      table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
    end
    stack[val] = nil
    return "{" .. table.concat(res, ",") .. "}"
  end
end


local function encode_string(val)
  return '"' .. val:gsub('[%z\1-\31\\"]', escape_char) .. '"'
end


local function encode_number(val)
  -- Check for NaN, -inf and inf
  if val ~= val or val <= -math.huge or val >= math.huge then
    error("unexpected number value '" .. tostring(val) .. "'")
  end
  return string.format("%.14g", val)
end


local type_func_map = {
  [ "nil"     ] = encode_nil,
  [ "table"   ] = encode_table,
  [ "string"  ] = encode_string,
  [ "number"  ] = encode_number,
  [ "boolean" ] = tostring,
}


encode = function(val, stack)
  local t = type(val)
  local f = type_func_map[t]
  if f then
    return f(val, stack)
  end
  error("unexpected type '" .. t .. "'")
end


function json.encode(val)
  return ( encode(val) )
end


-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
  local res = {}
  for i = 1, select("#", ...) do
    res[ select(i, ...) ] = true
  end
  return res
end

local space_chars   = create_set(" ", "\t", "\r", "\n")
local delim_chars   = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars  = create_set("\\", "/", '"', "b", "f", "n", "r", "t", "u")
local literals      = create_set("true", "false", "null")

local literal_map = {
  [ "true"  ] = true,
  [ "false" ] = false,
  [ "null"  ] = nil,
}


local function next_char(str, idx, set, negate)
  for i = idx, #str do
    if set[str:sub(i, i)] ~= negate then
      return i
    end
  end
  return #str + 1
end


local function decode_error(str, idx, msg)
  local line_count = 1
  local col_count = 1
  for i = 1, idx - 1 do
    col_count = col_count + 1
    if str:sub(i, i) == "\n" then
      line_count = line_count + 1
      col_count = 1
    end
  end
  error( string.format("%s at line %d col %d", msg, line_count, col_count) )
end


local function codepoint_to_utf8(n)
  -- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
  local f = math.floor
  if n <= 0x7f then
    return string.char(n)
  elseif n <= 0x7ff then
    return string.char(f(n / 64) + 192, n % 64 + 128)
  elseif n <= 0xffff then
    return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
  elseif n <= 0x10ffff then
    return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128,
                       f(n % 4096 / 64) + 128, n % 64 + 128)
  end
  error( string.format("invalid unicode codepoint '%x'", n) )
end


local function parse_unicode_escape(s)
  local n1 = tonumber( s:sub(1, 4),  16 )
  local n2 = tonumber( s:sub(7, 10), 16 )
   -- Surrogate pair?
  if n2 then
    return codepoint_to_utf8((n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000)
  else
    return codepoint_to_utf8(n1)
  end
end


local function parse_string(str, i)
  local res = ""
  local j = i + 1
  local k = j

  while j <= #str do
    local x = str:byte(j)

    if x < 32 then
      decode_error(str, j, "control character in string")

    elseif x == 92 then -- `\`: Escape
      res = res .. str:sub(k, j - 1)
      j = j + 1
      local c = str:sub(j, j)
      if c == "u" then
        local hex = str:match("^[dD][89aAbB]%x%x\\u%x%x%x%x", j + 1)
                 or str:match("^%x%x%x%x", j + 1)
                 or decode_error(str, j - 1, "invalid unicode escape in string")
        res = res .. parse_unicode_escape(hex)
        j = j + #hex
      else
        if not escape_chars[c] then
          decode_error(str, j - 1, "invalid escape char '" .. c .. "' in string")
        end
        res = res .. escape_char_map_inv[c]
      end
      k = j + 1

    elseif x == 34 then -- `"`: End of string
      res = res .. str:sub(k, j - 1)
      return res, j + 1
    end

    j = j + 1
  end

  decode_error(str, i, "expected closing quote for string")
end


local function parse_number(str, i)
  local x = next_char(str, i, delim_chars)
  local s = str:sub(i, x - 1)
  local n = tonumber(s)
  if not n then
    decode_error(str, i, "invalid number '" .. s .. "'")
  end
  return n, x
end


local function parse_literal(str, i)
  local x = next_char(str, i, delim_chars)
  local word = str:sub(i, x - 1)
  if not literals[word] then
    decode_error(str, i, "invalid literal '" .. word .. "'")
  end
  return literal_map[word], x
end


local function parse_array(str, i)
  local res = {}
  local n = 1
  i = i + 1
  while 1 do
    local x
    i = next_char(str, i, space_chars, true)
    -- Empty / end of array?
    if str:sub(i, i) == "]" then
      i = i + 1
      break
    end
    -- Read token
    x, i = parse(str, i)
    res[n] = x
    n = n + 1
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "]" then break end
    if chr ~= "," then decode_error(str, i, "expected ']' or ','") end
  end
  return res, i
end


local function parse_object(str, i)
  local res = {}
  i = i + 1
  while 1 do
    local key, val
    i = next_char(str, i, space_chars, true)
    -- Empty / end of object?
    if str:sub(i, i) == "}" then
      i = i + 1
      break
    end
    -- Read key
    if str:sub(i, i) ~= '"' then
      decode_error(str, i, "expected string for key")
    end
    key, i = parse(str, i)
    -- Read ':' delimiter
    i = next_char(str, i, space_chars, true)
    if str:sub(i, i) ~= ":" then
      decode_error(str, i, "expected ':' after key")
    end
    i = next_char(str, i + 1, space_chars, true)
    -- Read value
    val, i = parse(str, i)
    -- Set
    res[key] = val
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "}" then break end
    if chr ~= "," then decode_error(str, i, "expected '}' or ','") end
  end
  return res, i
end


local char_func_map = {
  [ '"' ] = parse_string,
  [ "0" ] = parse_number,
  [ "1" ] = parse_number,
  [ "2" ] = parse_number,
  [ "3" ] = parse_number,
  [ "4" ] = parse_number,
  [ "5" ] = parse_number,
  [ "6" ] = parse_number,
  [ "7" ] = parse_number,
  [ "8" ] = parse_number,
  [ "9" ] = parse_number,
  [ "-" ] = parse_number,
  [ "t" ] = parse_literal,
  [ "f" ] = parse_literal,
  [ "n" ] = parse_literal,
  [ "[" ] = parse_array,
  [ "{" ] = parse_object,
}


parse = function(str, idx)
  local chr = str:sub(idx, idx)
  local f = char_func_map[chr]
  if f then
    return f(str, idx)
  end
  decode_error(str, idx, "unexpected character '" .. chr .. "'")
end


function json.decode(str)
  if type(str) ~= "string" then
    error("expected argument of type string, got " .. type(str))
  end
  local res, idx = parse(str, next_char(str, 1, space_chars, true))
  idx = next_char(str, idx, space_chars, true)
  if idx <= #str then
    --decode_error(str, idx, "trailing garbage")
  end
  return res
end


function use_card(card, mute, nosave)
    
    local area = card.area
    local prev_state = G.STATE
    local dont_dissolve = nil
    local delay_fac = 1


    G.TAROT_INTERRUPT = G.STATE
    if card.ability.set == 'Booster' then G.GAME.PACK_INTERRUPT = G.STATE end 
    G.STATE = (G.STATE == G.STATES.TAROT_PACK and G.STATES.TAROT_PACK) or
      (G.STATE == G.STATES.PLANET_PACK and G.STATES.PLANET_PACK) or
      (G.STATE == G.STATES.SPECTRAL_PACK and G.STATES.SPECTRAL_PACK) or
      (G.STATE == G.STATES.STANDARD_PACK and G.STATES.STANDARD_PACK) or
      (G.STATE == G.STATES.BUFFOON_PACK and G.STATES.BUFFOON_PACK) or
      G.STATES.PLAY_TAROT
    
    if card.ability.set == 'Booster' then 
      delay(0.1)
      if card.ability.booster_pos then G.GAME.current_round.used_packs[card.ability.booster_pos] = 'USED' end
      draw_card(G.hand, G.play, 1, 'up', true, card, nil, true) 
      if not card.from_tag then 
        G.GAME.round_scores.cards_purchased.amt = G.GAME.round_scores.cards_purchased.amt + 1
      end
      card:open()
    end
    if card.ability.set == 'Booster' then
      G.CONTROLLER.locks.use = false
      G.TAROT_INTERRUPT = nil
    else
        G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.2,
        func = function()
            if not dont_dissolve then card:start_dissolve() end
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,
            func = function()
                G.STATE = prev_state
                G.TAROT_INTERRUPT=nil
                G.CONTROLLER.locks.use = false

                if (prev_state == G.STATES.TAROT_PACK or prev_state == G.STATES.PLANET_PACK or
                  prev_state == G.STATES.SPECTRAL_PACK or prev_state == G.STATES.STANDARD_PACK or
                  prev_state == G.STATES.BUFFOON_PACK) and G.booster_pack then
                  if area == G.consumeables then
                    G.booster_pack.alignment.offset.y = G.booster_pack.alignment.offset.py
                    G.booster_pack.alignment.offset.py = nil
                  elseif G.GAME.pack_choices and G.GAME.pack_choices > 1 then
                    if G.booster_pack.alignment.offset.py then 
                      G.booster_pack.alignment.offset.y = G.booster_pack.alignment.offset.py
                      G.booster_pack.alignment.offset.py = nil
                    end
                    G.GAME.pack_choices = G.GAME.pack_choices - 1
                  else
                      G.CONTROLLER.interrupt.focus = true
                      if prev_state == G.STATES.TAROT_PACK then inc_career_stat('c_tarot_reading_used', 1) end
                      if prev_state == G.STATES.PLANET_PACK then inc_career_stat('c_planetarium_used', 1) end
                      G.FUNCS.end_consumeable(nil, delay_fac)
                  end
                else
                  if G.shop then 
                    G.shop.alignment.offset.y = G.shop.alignment.offset.py
                    G.shop.alignment.offset.py = nil
                  end
                  if G.blind_select then
                    G.blind_select.alignment.offset.y = G.blind_select.alignment.offset.py
                    G.blind_select.alignment.offset.py = nil
                  end
                  if G.round_eval then
                    G.round_eval.alignment.offset.y = G.round_eval.alignment.offset.py
                    G.round_eval.alignment.offset.py = nil
                  end
                  if area and area.cards[1] then 
                    G.E_MANAGER:add_event(Event({func = function()
                      G.E_MANAGER:add_event(Event({func = function()
                        G.CONTROLLER.interrupt.focus = nil
                        if card.ability.set == 'Voucher' then 
                          G.CONTROLLER:snap_to({node = G.shop:get_UIE_by_ID('next_round_button')})
                        elseif area then
                          G.CONTROLLER:recall_cardarea_focus(area)
                        end
                      return true end }))
                    return true end }))
                  end
                end
            return true
          end}))
        return true
      end}))
    end
  end

  
return {
    on_enable = on_enable,
    on_disable = on_disable,
    on_key_pressed = on_key_pressed,
    on_pre_update = on_pre_update,
}