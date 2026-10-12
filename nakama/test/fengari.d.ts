declare module 'fengari' {
  const fengari: {
    lua: any
    lauxlib: any
    lualib: any
    to_luastring(s: string): Uint8Array
    to_jsstring(s: Uint8Array): string
  }
  export default fengari
}
