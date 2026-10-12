import { conformance } from '../../src/net/coop/serverConformance'
import { luaDriver } from './luaDriver'

conformance('Lua match (skystriker_coop.lua)', (data) => luaDriver(data))
