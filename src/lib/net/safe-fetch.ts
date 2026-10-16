import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import zlib from 'node:zlib'

// Server-side fetching of a URL a user typed in. The danger is being tricked into talking to
// something on the server's own network (cloud metadata, databases, admin panels), so:
//   1. every address the name resolves to must be public, not just the first one;
//   2. the connection is made to the address that was checked, so a second DNS answer cannot differ;
//   3. redirects are never followed, ports are limited, and the body is capped while it streams.

const ALLOWED_PORTS = new Set([80, 443, 8080, 8443])

const v4 = (ip: string) => ip.split('.').map(Number)

function isPublicV4(ip: string): boolean {
  const [a, b, c] = v4(ip)
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false // this-network, private, loopback, multicast/reserved
  if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
  if (a === 169 && b === 254) return false // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 192 && b === 0 && c === 0) return false
  if (a === 192 && b === 0 && c === 2) return false
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

/** Expands any IPv6 text form to eight 16-bit groups. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)
  if (dotted) {
    const [a, b, c, d] = v4(dotted[1])
    s = s.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail].map(g => parseInt(g, 16))
  return groups.length === 8 && groups.every(g => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null
}

const fromGroups = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

export function isPublicAddress(ip: string): boolean {
  const kind = net.isIP(ip)
  if (kind === 4) return isPublicV4(ip)
  if (kind !== 6) return false
  const g = expandV6(ip)
  if (!g) return false
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g
  if (g.every(x => x === 0)) return false // ::
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) return false // ::1
  // IPv4 carried inside IPv6: ::ffff:a.b.c.d, ::a.b.c.d, NAT64 64:ff9b::/96, 6to4 2002::/16
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) return isPublicV4(fromGroups(g6, g7))
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPublicV4(fromGroups(g6, g7))
  if (g0 === 0x2002) return isPublicV4(fromGroups(g1, g2))
  if ((g0 & 0xfe00) === 0xfc00) return false // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false // link-local fe80::/10
  if ((g0 & 0xff00) === 0xff00) return false // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return false // documentation
  return true
}

const BLOCKED_NAME = /(^|\.)(localhost|internal|local|localdomain|home\.arpa)\.?$/i

export interface SafePage {
  html: string
  truncated: boolean
}

export interface SafeFetchOptions {
  maxBytes?: number
  timeoutMs?: number
  /** Replaceable in tests. */
  resolve?: (host: string) => Promise<string[]>
}

async function defaultResolve(host: string): Promise<string[]> {
  return (await lookup(host, { all: true, verbatim: true })).map(r => r.address)
}

/** Returns the page's text, or null when the URL is unsafe, unreachable or not an HTML page. */
export async function safeFetchHtml(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafePage | null> {
  const { maxBytes = 1_000_000, timeoutMs = 8000, resolve = defaultResolve } = options

  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null

  const secure = url.protocol === 'https:'
  const port = url.port ? Number(url.port) : secure ? 443 : 80
  if (!ALLOWED_PORTS.has(port)) return null

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (BLOCKED_NAME.test(host)) return null

  let addresses: string[]
  try {
    addresses = net.isIP(host) ? [host] : await resolve(host)
  } catch {
    return null
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) return null

  const address = addresses[0]
  const family = net.isIP(address)

  return new Promise<SafePage | null>(resolvePage => {
    let settled = false
    const done = (value: SafePage | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePage(value)
    }

    const request = (secure ? https : http).request(
      {
        hostname: host,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Dotstell/1.0; +https://dotstell.app)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, br, deflate',
        },
        // The name was already resolved and checked; connect to exactly that address.
        lookup: (_name: string, opts: unknown, cb: (...args: unknown[]) => void) =>
          (opts as { all?: boolean })?.all ? cb(null, [{ address, family }]) : cb(null, address, family),
      } as https.RequestOptions,
      res => {
        const type = String(res.headers['content-type'] ?? '')
        // A redirect could point at an internal address, so it is treated as "no page".
        if (res.statusCode !== 200 || !/(text\/html|application\/xhtml)/i.test(type)) {
          res.resume()
          return done(null)
        }

        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase()
        const stream: NodeJS.ReadableStream =
          encoding === 'gzip' ? res.pipe(zlib.createGunzip())
          : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
          : encoding === 'deflate' ? res.pipe(zlib.createInflate())
          : res

        const chunks: Buffer[] = []
        let size = 0
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          chunks.push(chunk)
          if (size > maxBytes) {
            // Page metadata lives at the top; the rest is not worth reading.
            request.destroy()
            done({ html: Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8'), truncated: true })
          }
        })
        stream.on('end', () => done({ html: Buffer.concat(chunks).toString('utf8'), truncated: false }))
        stream.on('error', () => done(null))
      },
    )

    const timer = setTimeout(() => { request.destroy(); done(null) }, timeoutMs)
    request.on('error', () => done(null))
    request.end()
  })
}
