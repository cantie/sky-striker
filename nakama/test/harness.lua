-- Drives skystriker_coop.lua like Nakama would: one match instance, presences, ticks, RPCs.
-- Every function takes and returns strings (JSON) so the JS side stays simple.
local nk = require("nk_mock")
package.loaded["nakama"] = nk

local H = {}
_G.H = H
_G.nk = nk
local mod, state, tick, match_id
local env = {}
local present = {}
local sent = {}

local function dispatcher()
  return {
    broadcast_message = function(op, data, presences, sender, reliable)
      local to = nil
      if presences then
        to = {}
        for _, p in ipairs(presences) do to[#to + 1] = p.user_id end
      end
      sent[#sent + 1] = { op = op, data = data, to = to }
    end,
    match_label_update = function(label) nk.matches[match_id].label = label end,
    match_kick = function(presences) end,
  }
end

local function ctx(user_id) return { env = env, user_id = user_id, match_id = match_id, node = "node1" } end
local function size() local n = 0 for _ in pairs(present) do n = n + 1 end return n end

function H.preload_data(src) package.preload["skystriker_data"] = assert(load(src, "=skystriker_data")) return "" end
function H.load() mod = require("skystriker_coop") return "" end
function H.set_time(ms) nk.now = tonumber(ms) return "" end
function H.set_users(j) nk.users = nk.json_decode(j) return "" end
function H.set_accounts(j) for id, custom in pairs(nk.json_decode(j)) do nk.accounts[id] = custom end return "" end
function H.set_env(j) env = nk.json_decode(j) return "" end
function H.rpc(id, user_id, payload) return nk.rpcs[id](ctx(user_id ~= "" and user_id or nil), payload) end

function H.init(params_json, id)
  if id == "" then id = nil end
  local params = nk.json_decode(params_json)
  match_id = id or nk.match_create("skystriker_coop", params)
  nk.matches[match_id] = nk.matches[match_id] or { module = "skystriker_coop", params = params, label = "", size = 0 }
  local label
  state, tick, label = mod.match_init(ctx(nil), params)
  nk.matches[match_id].label = label
  tick = 0
  return match_id
end

function H.join(p_json, meta_json)
  local p, meta = nk.json_decode(p_json), nk.json_decode(meta_json)
  local accept, reason
  state, accept, reason = mod.match_join_attempt(ctx(p.user_id), dispatcher(), tick, state, p, meta)
  if not accept then return nk.json_encode({ ok = false, reason = reason }) end
  present[p.user_id] = p
  state = mod.match_join(ctx(p.user_id), dispatcher(), tick, state, { p })
  nk.matches[match_id].size = size()
  return nk.json_encode({ ok = true })
end

function H.leave(p_json)
  local p = nk.json_decode(p_json)
  present[p.user_id] = nil
  state = mod.match_leave(ctx(p.user_id), dispatcher(), tick, state, { p })
  nk.matches[match_id].size = size()
  return ""
end

function H.loop(msgs_json)
  local msgs = nk.json_decode(msgs_json)
  local list = {}
  for _, m in ipairs(msgs) do
    list[#list + 1] = { sender = present[m.from] or { user_id = m.from, session_id = m.from, username = m.from, node = "node1" },
      op_code = m.op, data = m.data, reliable = true, receive_time_ms = nk.now }
  end
  tick = tick + 1
  if state ~= nil then
    state = mod.match_loop(ctx(nil), dispatcher(), tick, state, list)
    if state == nil then nk.matches[match_id].ended = true end
  end
  local out = sent
  sent = {}
  return nk.json_encode(out)
end

function H.drain() local out = sent sent = {} return nk.json_encode(out) end
function H.ended() return state == nil and "true" or "false" end

function H.data_summary()
  local d = require("skystriker_data")
  local n = 0
  for _, s in ipairs(d.stages) do n = n + #s.enemies end
  return nk.json_encode({ version = d.version, stages = #d.stages, enemies = n, maxDps = d.maxDps })
end

function H.dump()
  local boards = {}
  for id, b in pairs(nk.boards) do
    local list = {}
    for _, r in pairs(b.records) do list[#list + 1] = r end
    boards[id] = list
  end
  local storage = {}
  for _, o in pairs(nk.storage) do storage[#storage + 1] = o end
  local matches = {}
  for id, m in pairs(nk.matches) do matches[id] = { label = m.label, size = m.size } end
  return nk.json_encode({ matches = matches, boards = boards, storage = storage, requests = nk.requests })
end

return H
