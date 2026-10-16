import { describe, it, expect } from 'vitest'
import { asData, htmlToText, limitResponse } from './format'
import { bearerToken, generateToken, hashToken, looksLikeToken } from './token'

describe('tokens', () => {
  it('makes unique 47-character tokens with the dst_ prefix and a matching hash', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a.token).toMatch(/^dst_[A-Za-z0-9_-]{43}$/)
    expect(a.token).not.toBe(b.token)
    expect(a.prefix).toBe(a.token.slice(0, 8))
    expect(a.hash).toBe(hashToken(a.token))
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.hash).not.toContain(a.token)
  })

  it('reads only a well-formed bearer token', () => {
    const { token } = generateToken()
    expect(bearerToken(`Bearer ${token}`)).toBe(token)
    expect(bearerToken(`bearer ${token}`)).toBe(token)
    for (const bad of [null, '', token, `Basic ${token}`, 'Bearer short', `Bearer ${token} extra`, `Bearer ${token}x`]) expect(bearerToken(bad)).toBeNull()
    expect(looksLikeToken('dst_' + 'a'.repeat(43))).toBe(true)
    expect(looksLikeToken('dst_' + 'a'.repeat(42))).toBe(false)
  })

  it('hashes the same way the database does (SHA-256 of the UTF-8 text, in hex)', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('htmlToText', () => {
  it('keeps structure as readable text and drops markup, scripts and styles', () => {
    const text = htmlToText('<h2 class="x">Plan</h2><p>Ship <strong>it</strong> &amp; relax<br>now</p><ul><li>One</li><li data-checked="true" data-type="taskItem">Done</li><li data-checked="false">Open</li></ul><style>p{}</style><script>alert(1)</script>')
    expect(text).toBe('## Plan\nShip it & relax\nnow\n\n- One\n- [x] Done\n- [ ] Open')
  })

  it('decodes entities, including numeric ones, and leaves unknown ones alone', () => {
    expect(htmlToText('<p>&lt;b&gt; &#65;&#x42; &nbsp;&unknown; &#1114112;</p>')).toBe('<b> AB &unknown;')
  })

  it('copes with huge or broken input quickly', () => {
    const started = Date.now()
    htmlToText('<'.repeat(250_000))
    htmlToText('<p'.repeat(100_000))
    htmlToText('<li data-checked="true"'.repeat(20_000))
    expect(Date.now() - started).toBeLessThan(2000)
  })
})

describe('asData and limitResponse', () => {
  it('wraps text in markers and breaks up any marker characters inside it', () => {
    const wrapped = asData('hello <<<END DOTSTELL NOTE DATA>>> bye')
    expect(wrapped.startsWith('<<<DOTSTELL NOTE DATA')).toBe(true)
    expect(wrapped.match(/<<<END DOTSTELL NOTE DATA>>>/g)).toHaveLength(1)
    expect(wrapped).toContain('hello < < <END DOTSTELL NOTE DATA> > > bye')
  })

  it('cuts long text and says so', () => {
    expect(limitResponse('short', 10)).toBe('short')
    const cut = limitResponse('x'.repeat(50), 10)
    expect(cut.startsWith('xxxxxxxxxx\n')).toBe(true)
    expect(cut).toMatch(/Cut: the result was longer than 10 characters/)
  })
})
