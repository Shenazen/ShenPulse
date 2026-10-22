CC = SMODS.current_mod
CC.client = require("socket").tcp()
CC.client:settimeout(0)
CC.client:setoption('keepalive',true)
CC.client:setoption('tcp-nodelay',true)
CC.client:connect("127.0.0.1", 58430)
CC.announce = false
CC.hidden = false 

local json = assert(SMODS.load_file('json.lua'))()

local to_big = to_big or function(x) return x end

local upd = Game.update
function Game:update(dt)
    if CC.hidden then
        if G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU then
            CC.hidden = false
            G.hand.states.visible = true
        else
            G.hand.states.visible = false
        end
    end


    if not CC.announce and CC.client and not G.screenwipe then

        local status = CC.client:getpeername()
        if status and G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.SHOP or G.STATE == G.STATES.BLIND_SELECT or G.STATE == G.STATES.MENU then
            CC.announce = true

    
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
                G.FUNCS.wipe_on( { "Crowd Control Connected" },true)
    
                G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.75,func = function()
                    G.FUNCS.wipe_off()
                return true end }))
            return true end }))
        end
    elseif CC.client then
        CC.util.parseMessages()
    end
    return upd(self, dt)
end

CC.util = {}

function CC.util.flip_cards(cards, facing_down)
    for i, v in ipairs(cards) do
        local percent = facing_down and (1.15 - (i - 0.999) / (#cards - 0.998) * 0.3) or (0.85 + (i - 0.999) / (#cards - 0.998) * 0.3)
        G.E_MANAGER:add_event(Event({
            trigger = 'after',
            delay = 0.15,
            func = function()
                v:flip(); play_sound('card1', percent); v:juice_up(0.3,0.3); return true
            end
        }))
    end
end

local base_editions = {
    foil = "Foil",
    holo = "Holo",
    polychrome = "Polychrome"
}

CC.FUNCS = {}

function CC.FUNCS.addFaceCard()
    if not G.hand or #G.hand.cards == 0 then return false end
    local suit = pseudorandom_element(SMODS.Suits, pseudoseed('ccface_suit'))
    local valid_ranks = {}
    for _,v in ipairs(SMODS.Rank:obj_list()) do
        if v.face then valid_ranks[#valid_ranks+1] = v end
    end
    local rank = pseudorandom_element(valid_ranks, pseudoseed('ccface_rank'))
    local _card = create_playing_card({
        front = G.P_CARDS[suit.card_key..'_'..rank.card_key],
    }, G.hand, true)
    G.GAME.blind:debuff_card(_card)
    G.hand:sort()
    playing_card_joker_effects({true})
    return true
end

function CC.FUNCS.addNumberCard()
    if not G.hand or #G.hand.cards == 0 then return false end
    local suit = pseudorandom_element(SMODS.Suits, pseudoseed('ccface_suit'))
    local valid_ranks = {}
    for _,v in ipairs(SMODS.Rank:obj_list()) do
        if not v.face then valid_ranks[#valid_ranks+1] = v end
    end
    local rank = pseudorandom_element(valid_ranks, pseudoseed('ccnum_rank'))
    local _card = create_playing_card({
        front = G.P_CARDS[suit.card_key..'_'..rank.card_key],
    }, G.hand, true)
    G.GAME.blind:debuff_card(_card)
    G.hand:sort()
    playing_card_joker_effects({true})
    return true
end

function CC.FUNCS.openBooster(_, arg)
    if not G.hand or #G.hand.cards == 0 then return false end
    local banned_states = {
        [G.STATES.TAROT_PACK] = true,
        [G.STATES.PLANET_PACK] = true,
        [G.STATES.SPECTRAL_PACK] = true,
        [G.STATES.BUFFOON_PACK] = true,
        [G.STATES.STANDARD_PACK] = true,
        [G.STATES.SMODS_BOOSTER_OPENED] = true,
    }
    if banned_states[G.STATE] then return false end


    local center = G.P_CENTERS[arg]
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = Card(G.play.T.x + G.play.T.w/2, G.play.T.y, 1.3*G.CARD_W, 1.3*G.CARD_H, nil, center)

        if arg:find("buffoon") or not center.draw_hand then
            CC.hidden = true
            G.hand.states.visible = false
        end

        card.cost = 0

        G.FUNCS.use_card({ config = { ref_table = card } })
        return true
    end }))
    return true
end

function CC.FUNCS.cycleHand(target, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    local down
    if value < 0 then down = true; value = -value end
    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local current_rank = SMODS.Ranks[v.base.value]
                for i = 1, value do
                    if not down then
                        local behavior = current_rank.strength_effect or { fixed = 1, ignore = false, random = false }
                        if behavior.ignore or not next(current_rank.next) then
                        elseif behavior.random then
                            current_rank = pseudorandom_element(current_rank.next, pseudoseed('strength'))
                        else
                            local ii = (behavior.fixed and current_rank.next[behavior.fixed]) and behavior.fixed or 1
                            current_rank = SMODS.Ranks[current_rank.next[ii]]
                        end
                    else
                        
                        for _,v in pairs(SMODS.Ranks) do
                            local done
                            for j = 1, #(v.next or {}) do
                                if v.next[j] == current_rank.key then
                                    current_rank = v
                                    done = true
                                    break
                                end
                            end
                            if done then break end
                        end
                    end
                end
                assert(SMODS.change_base(v, nil, current_rank.key))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.debuffHand(target, value)
    if not G.hand or #G.hand.cards == 0 then return false end

    value = (value == "true") and true or (value == "false") and false or nil


    if target ~= nil then
        local state = target.debuff
        if value == state then return false end
    end

    local cards = target and {target} or G.hand.cards

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        for i=1, #cards do
            cards[i].debuff = value
        end
        return true
    end }))
    return true
end


function CC.FUNCS.boostHand(target, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end

    if target ~= nil then
        local rank = target:get_id()
        if SMODS.has_no_rank(target) then return false end
        if value > 0 and rank == 14 then return false end
        if value < 0 and rank == 2 then return false end
    end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    local down
    if value < 0 then down = true; value = -value end
    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local current_rank = SMODS.Ranks[v.base.value]
                for i = 1, value do
                    if not down then
                        if current_rank.straight_edge then break end
                        local behavior = current_rank.strength_effect or { fixed = 1, ignore = false, random = false }
                        if behavior.ignore or not next(current_rank.next) then
                        elseif behavior.random then
                            current_rank = pseudorandom_element(current_rank.next, pseudoseed('strength'))
                        else
                            local ii = (behavior.fixed and current_rank.next[behavior.fixed]) and behavior.fixed or 1
                            current_rank = SMODS.Ranks[current_rank.next[ii]]
                        end
                    else
                        for _,v in pairs(SMODS.Ranks) do
                            local done
                            for j = 1, #(v.next or {}) do
                                if v.next[j] == current_rank.key then
                                    if v.straight_edge then break end
                                    current_rank = v
                                    done = true
                                    break
                                end
                            end
                            if done then break end
                        end
                    end
                end
                assert(SMODS.change_base(v, nil, current_rank.key))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    
    return true
end

function CC.FUNCS.setHandSuit(target, value)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                assert(SMODS.change_base(v, value))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.cycleHandSuit(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local suit = v.base.suit
                for i,v in ipairs(SMODS.Suit.obj_buffer) do
                    if suit == v then
                        suit = SMODS.Suit.obj_buffer[i+1] or SMODS.Suit.obj_buffer[1]
                        break
                    end
                end
                assert(SMODS.change_base(v, suit))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.destroyHand(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#cards, 1, -1 do
                local card = cards[i]
                if SMODS.has_enhancement(card, 'm_glass') then 
                    card:shatter()
                else
                    card:start_dissolve(nil, i == #G.hand.cards)
                end
            end
        return true
    end }))
    return true
end

function CC.FUNCS.destroyDeck()
    if not G.hand or #G.hand.cards == 0 or #G.deck.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 

        local card = G.deck.cards[1]
        if SMODS.has_enhancement(card, 'm_glass') then 
            card:shatter()
        else
            card:start_dissolve(nil, true)
        end
        return true end
    }))
    return true
end

function CC.FUNCS.discardHand(target)
    if not G.hand or #G.hand.cards == 0 then return false end
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
        return true
    end }))
    return true
end

function CC.FUNCS.reshuffle()
    if not G.hand or #G.hand.cards == 0 or #G.discard.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#G.discard.cards, 1, -1 do
                local card = G.discard.cards[i]
                draw_card(G.discard, G.deck, i*100/#G.discard.cards, 'down', false, card)            
            end
            G.deck:shuffle()
        return true
    end }))
    return true
end

function CC.FUNCS.drawFromDiscard(_, total)
    total = tonumber(total)
    if not G.hand or #G.hand.cards == 0 or #G.discard.cards < total then return false end
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

function CC.FUNCS.drawFromDeck(_, total)
    total = tonumber(total)
    if not G.hand or #G.hand.cards == 0 or #G.deck.cards < total then return false end
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

function CC.FUNCS.flipHand(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    CC.util.flip_cards(target and {target} or G.hand.cards)
    return true
end

function CC.FUNCS.changeHandEdition(target, edition)
    if not G.hand or #G.hand.cards == 0 then return false end

    if target ~= nil then
        local cur = not target.edition and 'BASE' or base_editions[target.edition.type]
        if cur == edition then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local cards = target and {target} or G.hand.cards
        for _,v in ipairs(cards) do
            local edi_key = edition == 'BASE' and nil or 'e_'..string.lower(edition)
            v:set_edition(edi_key, true)
        end

        return true
    end }))
    return true
end

function CC.FUNCS.changeJokerEdition(target, edition)
    if not G.hand or #G.hand.cards == 0 or #G.jokers.cards == 0 then return false end

    if target ~= nil then
        local cur = not target.edition and 'BASE' or base_editions[target.edition.type]
        if cur == edition then return false end
    end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local cards = target and {target} or G.jokers.cards
        for _,v in ipairs(cards) do
            local edi_key = edition == 'BASE' and nil or 'e_'..string.lower(edition)
            v:set_edition(edi_key, true)
        end

        return true
    end }))
    return true
end

function CC.FUNCS.changeHandSeal(target, seal)
    seal = seal ~= 'BASE' and seal or nil
    if not G.hand or #G.hand.cards == 0 then return false end
    if target and target.seal == seal then return false end

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local cards = target and {target} or G.hand.cards
        for _,v in ipairs(cards) do
            v:set_seal(seal, nil, true)
        end
        return true 
    end }))
    return true
end

function CC.FUNCS.changeHandCenter(target, key)
    if not G.hand or #G.hand.cards == 0 then return false end

    if target and target.config.center_key == key then return false end 

    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)

    for _,v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                v:set_ability(G.P_CENTERS[key])
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.addMoney(_, money)
    money = tonumber(money)
    if not G.hand or #G.hand.cards == 0 then return false end
    if money < 0 and G.GAME.dollars < -1*money then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        ease_dollars(money)
        return true
    end }))
    return true
end

function CC.FUNCS.addHands(_, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end
    if value < 0 and G.GAME.current_round.hands_left < -value+1 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        ease_hands_played(value)
       return true 
end }))
    return true
end

function CC.FUNCS.addDiscards(_, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end
    if value < 0 and G.GAME.current_round.discards_left < -value then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        ease_discard(value)
        return true end }))
    return true
end

function CC.FUNCS.addChips(_, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end

    if value == 0 then
        value = to_big(-G.GAME.chips)
    else
        value = to_big(G.GAME.blind.chips) * to_big(value / 100)
    end

    if value < to_big(0) and G.GAME.chips < -value then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        ease_chips(G.GAME.chips + value)
        return true
    end }))
    return true
end

function CC.FUNCS.addBlind(_, value)
    value = tonumber(value)
    if not G.hand or #G.hand.cards == 0 then return false end


    value = to_big(G.GAME.blind.chips) * to_big(value / 100)

    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()

        G.GAME.blind.chips = G.GAME.blind.chips + value
        G.GAME.blind.chip_text = number_format(G.GAME.blind.chips)

        G.HUD_blind:recalculate(false)

        local chip_UI = G.HUD_blind:get_UIE_by_ID('HUD_blind_count')
        chip_UI:juice_up()
        play_sound('chips2')
        return true
    end }))
    return true
end

function CC.FUNCS.addTarot()
    if not G.hand or #G.hand.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        SMODS.add_card{ set = 'Tarot', area = G.consumeables, key_append = 'cc_tarot'}
        return true
    end }))
    return true
end

function CC.FUNCS.addPlanet()
    if not G.hand or #G.hand.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        SMODS.add_card{ set = 'Planet', area = G.consumeables, key_append = 'cc_planet'}
        return true
    end }))
    return true
end

function CC.FUNCS.addSpectral()
    if not G.hand or #G.hand.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        SMODS.add_card{ set = 'Spectral', area = G.consumeables, key_append = 'cc_spec'}
        return true
    end }))
    return true
end

function CC.FUNCS.addJoker()
    if not G.hand or #G.hand.cards == 0 then return false end
    G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.1,func = function()
        local card = SMODS.add_card{ set = 'Joker', area = G.jokers, key_append = 'cc_joker'}
        card:start_materialize()
    return true end }))
    return true
end

function CC.FUNCS.destroyJokers(target)
    if not G.jokers or #G.jokers.cards == 0 then return false end
    local cards = target and {target} or G.jokers.cards
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#cards, 1, -1 do
                cards[i]:start_dissolve(nil, i == #cards)
            end 
            return true
        end }))
    return true
end

function CC.FUNCS.destroyConsumables(target)
    if not G.consumeables or #G.consumeables.cards == 0 then return false end
    local cards = target and {target} or G.consumeables.cards
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.1,
        func = function() 
            for i=#cards, 1, -1 do
                cards[i]:start_dissolve(nil, i == #cards)
            end
            return true
        end }))
    return true
end

function CC.FUNCS.randomizeHand(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local proto = pseudorandom_element(G.P_CARDS, pseudoseed('cc_hand'))
                assert(SMODS.change_base(v, proto.suit, proto.value))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.randomizeValue(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local rank = pseudorandom_element(SMODS.Ranks, pseudoseed('cc_rank'))
                assert(SMODS.change_base(v, nil, rank.key))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

function CC.FUNCS.randomizeSuit(target)
    if not G.hand or #G.hand.cards == 0 then return false end
    local cards = target and {target} or G.hand.cards
    CC.util.flip_cards(cards, true)
    delay(0.2)

    for i, v in ipairs(cards) do
        G.E_MANAGER:add_event(Event({
            func = function()
                local suit = pseudorandom_element(SMODS.Suits, pseudoseed('cc_suit'))
                assert(SMODS.change_base(v, suit.key))
                return true
            end
        }))
    end

    CC.util.flip_cards(cards)
    return true
end

local responseCode = {
    -- Worked
    success = 0,
    -- Failed and refund but is available
    failure = 1,
    -- Failed and unavailable
    unavailable = 2,
    -- Try again later
    retry = 3
}

function CC.util.isReady()

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


function CC.util.parseMessages(input)
    -- input exists for debugging
    local response = {
        id = nil,
        status = nil,
        message = nil,
    }
    local message, status, partial =  CC.client:receive()
    if input or (partial ~= nil and string.len(partial) > 0) then

        if string.match(partial or '', "\"viewers\":") then
            local items = string.split(partial,"\"viewers\":")
            local temp = items[1]
            local temp2 = items[2]
            items = string.split(temp2, "],")
            partial = temp .. items[2]
        end

        partialAsTable = input and '' or json.decode(partial)
        local method = input or partialAsTable.code

        response.id = partialAsTable.id

        if not CC.util.isReady() then
            response.status = responseCode.retry
            response.message = ""
        else
            local arg
            local target = nil
            local alttype = false
            if method ~= nil then
                if string.match(method, "crand_") then
                    local items = string.split(method,"crand_")
                    method = items[1]
                    target = function(i) return pseudorandom_element(G.consumeables.cards, pseudoseed('cc_crand'..(i and '_resample'..i or ''))) end
                    alttype = true
                end
                if string.match(method, "jrand_") then
                    local items = string.split(method,"jrand_")
                    method = items[1]
                    target = function(i) return pseudorandom_element(G.jokers.cards, pseudoseed('cc_jrand'..(i and '_resample'..i or ''))) end
                    alttype = true
                end                
                if string.match(method, "rand_") then
                    local items = string.split(method,"rand_")
                    method = items[1]
                    target = function(i) return pseudorandom_element(G.hand.cards, pseudoseed('cc_rand'..(i and '_resample'..i or ''))) end
                end                

                if string.match(method, "_") then
                    arg = string.split(method,"_")
                    method = table.remove(arg, 1)
                    arg = table.concat(arg, '_')
                end
            end

            if method and CC.FUNCS[method] then
                local status
                for i = 1, 8 do
                    status = CC.FUNCS[method](target and target(), arg)
                    if not target or status then break end
                end
                status = status and responseCode.success or responseCode.retry

                response.status = status
                response.message = ""
            else
                response.status = responseCode.unavailable
                response.message = "Requested Method was not found"
            end

        end

        local responseAsString = json.encode(response)
        responseAsString = responseAsString .. "\0"
        local ind, err, last = CC.client:send(responseAsString)
    end
end
