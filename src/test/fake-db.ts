// A stand-in for the Supabase client that records every query instead of running it. Tests use it to
// check WHAT a route asks the database to do, and in what order, without needing a database.

export interface Call {
  table: string
  steps: [string, unknown[]][]
}

export type Responder = (call: Call) => { data?: unknown; error?: unknown } | undefined

export function makeDb(respond: Responder = () => undefined, userId = 'u1') {
  const calls: Call[] = []
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from(table: string) {
      const call: Call = { table, steps: [] }
      calls.push(call)
      const query: unknown = new Proxy({}, {
        get(_target, prop) {
          // Awaiting the chain runs it.
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, ...(respond(call) ?? {}) }).then(resolve, reject)
          }
          return (...args: unknown[]) => { call.steps.push([String(prop), args]); return query }
        },
      })
      return query
    },
  }
  return { db, calls }
}

export const ops = (call: Call) => call.steps.map(([name]) => name)
export const stepArgs = (call: Call, name: string) => call.steps.find(([n]) => n === name)?.[1]
/** Index of the first call to `table` that used `op`, or -1. */
export const firstIndex = (calls: Call[], table: string, op: string) => calls.findIndex(c => c.table === table && ops(c).includes(op))
