-- Minimal JSON for the test mock of the nakama module. Like Nakama's Lua runtime, an empty
-- table encodes as {} (the client must cope with that), arrays are 1..n tables, nil is null.
local json = {}

local function kind(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  if n == 0 then return "object" end
  for i = 1, n do if t[i] == nil then return "object" end end
  return "array"
end

local escapes = { ['"'] = '\\"', ["\\"] = "\\\\", ["\b"] = "\\b", ["\f"] = "\\f", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }

local function encode(v)
  local t = type(v)
  if v == nil then return "null"
  elseif t == "boolean" then return v and "true" or "false"
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    -- %.0f, not %d: fengari integers are 32-bit and server times are ~1.7e12
    if v == math.floor(v) and math.abs(v) < 1e15 then return string.format("%.0f", v) end
    return string.format("%.14g", v)
  elseif t == "string" then
    return '"' .. v:gsub('[%c"\\]', function(c) return escapes[c] or string.format("\\u%04x", c:byte()) end) .. '"'
  elseif t == "table" then
    local parts = {}
    if kind(v) == "array" then
      for i = 1, #v do parts[i] = encode(v[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    for k, x in pairs(v) do parts[#parts + 1] = encode(tostring(k)) .. ":" .. encode(x) end
    table.sort(parts)
    return "{" .. table.concat(parts, ",") .. "}"
  end
  error("cannot encode " .. t)
end
json.encode = encode

function json.decode(s)
  local pos = 1
  local function ws() pos = s:find("[^ \t\r\n]", pos) or (#s + 1) end
  local value
  local function str()
    local out, i = {}, pos + 1
    while true do
      local c = s:sub(i, i)
      if c == '"' then pos = i + 1 return table.concat(out) end
      if c == "\\" then
        local e = s:sub(i + 1, i + 1)
        local map = { b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }
        if e == "u" then out[#out + 1] = string.char(tonumber(s:sub(i + 2, i + 5), 16) % 256) i = i + 6
        else out[#out + 1] = map[e] or e i = i + 2 end
      elseif c == "" then error("unterminated string")
      else out[#out + 1] = c i = i + 1 end
    end
  end
  function value()
    ws()
    local c = s:sub(pos, pos)
    if c == "{" then
      local t = {}
      pos = pos + 1 ws()
      if s:sub(pos, pos) == "}" then pos = pos + 1 return t end
      while true do
        ws() local k = str() ws()
        pos = pos + 1 -- :
        t[k] = value() ws()
        local d = s:sub(pos, pos) pos = pos + 1
        if d == "}" then return t end
      end
    elseif c == "[" then
      local t = {}
      pos = pos + 1 ws()
      if s:sub(pos, pos) == "]" then pos = pos + 1 return t end
      while true do
        t[#t + 1] = value() ws()
        local d = s:sub(pos, pos) pos = pos + 1
        if d == "]" then return t end
      end
    elseif c == '"' then return str()
    elseif s:sub(pos, pos + 3) == "true" then pos = pos + 4 return true
    elseif s:sub(pos, pos + 4) == "false" then pos = pos + 5 return false
    elseif s:sub(pos, pos + 3) == "null" then pos = pos + 4 return nil
    else
      local num = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", pos)
      pos = pos + #num
      return tonumber(num)
    end
  end
  return value()
end

return json
