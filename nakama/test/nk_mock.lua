-- Test double for Nakama's Lua `nakama` module: deterministic time, an in-memory match list,
-- leaderboards (operator "best", desc) and storage, and an HTTP stub for /api/me.
local json = require("json")
local nk = { now = 0, users = {}, rpcs = {}, matches = {}, boards = {}, storage = {}, logs = {}, next_match = 0, next_uuid = 0 }

nk.json_encode = json.encode
nk.json_decode = json.decode
function nk.time() return nk.now end
for _, lvl in ipairs({ "debug", "info", "warn", "error" }) do
  nk["logger_" .. lvl] = function(msg) nk.logs[#nk.logs + 1] = lvl .. ": " .. tostring(msg) end
end
function nk.register_rpc(fn, id) nk.rpcs[id] = fn end

function nk.match_create(module, params)
  nk.next_match = nk.next_match + 1
  local id = "m" .. nk.next_match .. ".node1"
  nk.matches[id] = { module = module, params = params, label = "", size = 0 }
  nk.last_match = id
  return id
end

-- Supports the query shapes the module uses: "+label.<field>:<value>" and "+label.<field>:>=<n>"
local function label_matches(label, query)
  local ok, l = pcall(json.decode, label)
  if not ok or type(l) ~= "table" then return false end
  for field, op, value in query:gmatch("%+label%.([%w_]+):(>?=?)([^%s]+)") do
    local v = l[field]
    if op == ">=" then
      if type(v) ~= "number" or v < tonumber(value) then return false end
    elseif tostring(v) ~= value then return false end
  end
  return true
end

function nk.match_list(limit, authoritative, label, min_size, max_size, query)
  local out = {}
  local ids = {}
  for id in pairs(nk.matches) do ids[#ids + 1] = id end
  table.sort(ids)
  for _, id in ipairs(ids) do
    local m = nk.matches[id]
    if not m.ended and m.size >= (min_size or 0) and m.size <= (max_size or 100) and (not query or label_matches(m.label, query)) then
      out[#out + 1] = { match_id = id, authoritative = true, label = m.label, size = m.size, tick_rate = 20, handler_name = m.module }
      if #out >= limit then break end
    end
  end
  return out
end

function nk.leaderboard_create(id, authoritative, sort, operator, reset, metadata, enable_ranks)
  nk.boards[id] = nk.boards[id] or { sort = sort, operator = operator, records = {} }
end

local function better(a, b) return a.score > b.score or (a.score == b.score and a.subscore > b.subscore) end

-- Operator "best", desc, as Nakama's SQL does it (core_leaderboard.go): score and subscore are each
-- GREATEST(old, new) on their own, and metadata/username are replaced whenever either one improves.
function nk.leaderboard_record_write(id, owner, username, score, subscore, metadata)
  subscore = subscore or 0
  assert(math.floor(score) == score and math.floor(subscore) == subscore, "scores must be integers")
  local b = assert(nk.boards[id], "no leaderboard " .. id)
  local old = b.records[owner]
  if not old then
    b.records[owner] = { leaderboard_id = id, owner_id = owner, username = username, score = score, subscore = subscore, metadata = metadata }
  elseif old.score < score or old.subscore < subscore then
    old.score, old.subscore = math.max(old.score, score), math.max(old.subscore, subscore)
    if metadata ~= nil then old.metadata = metadata end
    if username ~= nil then old.username = username end
  end
  return b.records[owner]
end

function nk.leaderboard_records_list(id, owners, limit, cursor, expiry)
  -- Like Nakama (runtime_lua_nakama.go): an empty owners table returns one empty table, no top rows
  if type(owners) == "table" and #owners == 0 then return {} end
  local b = assert(nk.boards[id], "no leaderboard " .. id)
  local all = {}
  for _, r in pairs(b.records) do all[#all + 1] = r end
  table.sort(all, function(a, c) if better(a, c) then return true end if better(c, a) then return false end return a.owner_id < c.owner_id end)
  local records, owner_records, want = {}, {}, {}
  for _, o in ipairs(owners or {}) do want[o] = true end
  for i, r in ipairs(all) do
    local copy = {}
    for k, v in pairs(r) do copy[k] = v end
    copy.rank = i
    if i <= limit then records[#records + 1] = copy end
    if want[r.owner_id] then owner_records[#owner_records + 1] = copy end
  end
  return records, owner_records, nil, nil
end

local function skey(o) return o.collection .. "/" .. o.key .. "/" .. (o.user_id or "") end
function nk.storage_read(list)
  local out = {}
  for _, q in ipairs(list) do
    local o = nk.storage[skey(q)]
    if o then out[#out + 1] = o end
  end
  return out
end
function nk.storage_write(list)
  for _, o in ipairs(list) do nk.storage[skey(o)] = o end
end

-- Nakama user id → custom id ("skystriker-<game id>"), set by the tests
nk.accounts = {}
function nk.account_get_id(user_id)
  local custom = nk.accounts[user_id]
  if not custom then error("account not found: " .. tostring(user_id)) end
  return { user_id = user_id, username = user_id, custom_id = custom }
end

nk.requests = {}
function nk.http_request(url, method, headers, content, timeout)
  nk.requests[#nk.requests + 1] = url
  local token = headers and headers.Authorization and headers.Authorization:match("^Bearer (.+)$")
  local user = token and nk.users[token]
  if url:match("/api/me$") and user then
    return 200, {}, json.encode({ user = user, progress = {} })
  end
  return 401, {}, '{"message":"Unauthorized"}'
end

-- Not MD5, but stable 32 hex chars, which is all the module relies on
function nk.md5_hash(s)
  -- (small moduli: fengari integers are 32-bit)
  local out = {}
  for round = 1, 8 do
    local h = 7 * round
    for i = 1, #s do h = (h * 31 + s:byte(i) * round) % 65521 end
    out[round] = string.format("%04x", h)
  end
  return table.concat(out)
end

function nk.uuid_v4()
  nk.next_uuid = nk.next_uuid + 1
  return string.format("00000000-0000-4000-8000-%012d", nk.next_uuid)
end

-- Lets the module register test-only hooks (Nakama never sets this)
nk.debug_hooks = true

return nk
