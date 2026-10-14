'use client'
import { useState, useLayoutEffect } from 'react'

/**
 * Layout tiers, chosen from this app's own geometry rather than from device names.
 *
 * The sidebar is 240px expanded and the note editor needs roughly 600px to be comfortable
 * to write in, so a genuine two-pane layout needs about 840px. Below that a 64px icon rail
 * still fits without crowding the content; below ~600px even that is too much and
 * navigation has to move out of the way entirely.
 *
 * Those thresholds line up with the Material 3 window size classes (600 / 840), which
 * exist for exactly this problem — tablets, foldables, split-screen and free rotation —
 * so we follow an established, widely-tested set of breakpoints instead of inventing our
 * own. Everything keys off viewport WIDTH, never off device type, which is what makes
 * rotation, iPad Split View, and folding phones all fall out correctly for free.
 */
export type LayoutTier = 'compact' | 'medium' | 'expanded'

const MEDIUM_MIN   = 600
const EXPANDED_MIN = 840

// Below this the viewport is too short to spend 56px on a bottom bar (a phone in
// landscape is only ~390px tall). A vertical rail costs no vertical space, so short
// viewports get the rail regardless of how wide they are.
const SHORT_VIEWPORT_MAX = 500

// The note editor stacks up three fixed columns before any text appears: the 240px app
// sidebar, NotesLayout's 220px notes pane, and the editor's own 240px right panel — 700px
// of chrome. The right panel only earns a permanent place once what remains is still a
// comfortable ~600px writing column, so it needs roughly 1300px; below that it opens as a
// bottom sheet from the header instead. (At 1194px — an 11" iPad in landscape — keeping it
// would leave under 500px to actually write in.)
const EDITOR_SIDE_PANEL_MIN = 1300

export interface Breakpoint {
  tier: LayoutTier
  /**
   * Coarse pointer — a finger rather than a mouse. This must only ever influence
   * ERGONOMICS (hit-target size, tap instead of hover), never layout: an iPad in
   * landscape has just as much room as a laptop and should use it. Conflating the two is
   * what previously gave a 1194px-wide tablet a phone's bottom tab bar.
   */
  isTouch: boolean
  isShortViewport: boolean

  // ── Derived navigation decisions. Exactly one of these three is ever true. ──
  /** Bottom tab bar plus an overlay drawer — the phone pattern. */
  showBottomNav: boolean
  /** Persistent 64px icon rail, expandable on demand. */
  showRail: boolean
  /** Persistent 240px sidebar, collapsible by the user. */
  showFullSidebar: boolean

  /** Editor's right panel can be a permanent column rather than a bottom sheet. */
  showEditorSidePanel: boolean
}

function isEditableFocused(): boolean {
  let node: Element | null = document.activeElement
  while (node && node !== document.body) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)) return true
    if ((node as HTMLElement).isContentEditable) return true
    node = node.parentElement
  }
  return false
}

// The viewport's height says nothing about the device's orientation while an on-screen
// keyboard is up: the layout viewport shrinks with it (see interactiveWidget in the root
// layout), so a portrait phone briefly looks like a 450px-tall landscape one. The screen's
// own orientation is unaffected by the keyboard.
function deviceIsLandscape(): boolean {
  const type = window.screen.orientation?.type
  return type ? type.startsWith('landscape') : window.innerWidth > window.innerHeight
}

// Last short-viewport verdict reached while no keyboard was involved, and the device
// orientation it was reached in.
let settled: { landscape: boolean; short: boolean } | null = null

function measure(): Breakpoint {
  // innerWidth (the layout viewport) rather than visualViewport, so an open keyboard
  // pinching the visual viewport can never be mistaken for a smaller device.
  const w = window.innerWidth
  const h = window.innerHeight

  const isTouch = window.matchMedia('(pointer: coarse)').matches
  const tier: LayoutTier = w < MEDIUM_MIN ? 'compact' : w < EXPANDED_MIN ? 'medium' : 'expanded'
  // A focused text field on a touch device means the keyboard is probably what made the
  // viewport short. In that case the height says nothing about the device, so hold whatever
  // was decided before the keyboard appeared (same orientation) instead of letting the nav
  // flip between layouts — and shove the editor sideways — every time someone starts typing.
  const landscape = deviceIsLandscape()
  const heightLooksShort = h < SHORT_VIEWPORT_MAX
  const keyboardLikely = isTouch && isEditableFocused()
  let isShortViewport: boolean
  if (heightLooksShort && keyboardLikely) {
    isShortViewport = settled && settled.landscape === landscape ? settled.short : landscape
  } else {
    isShortViewport = heightLooksShort
    settled = { landscape, short: heightLooksShort }
  }

  return {
    tier,
    isTouch,
    isShortViewport,
    showBottomNav:   tier === 'compact' && !isShortViewport,
    showRail:        isShortViewport || tier === 'medium',
    showFullSidebar: !isShortViewport && tier === 'expanded',
    showEditorSidePanel: w >= EDITOR_SIDE_PANEL_MIN,
  }
}

// Server-safe default. The server has no window, and guessing here would risk a hydration
// mismatch — which in this app has previously torn down the Tiptap editor mid-mount. The
// layout effect below corrects it before the browser paints, so nothing is ever visible.
const SSR_DEFAULT: Breakpoint = {
  tier: 'expanded',
  isTouch: false,
  isShortViewport: false,
  showBottomNav: false,
  showRail: false,
  showFullSidebar: true,
  showEditorSidePanel: true,
}

/** Single source of truth for every responsive layout decision in the app. */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(SSR_DEFAULT)

  useLayoutEffect(() => {
    const sync = () => setBp(prev => {
      const next = measure()
      // Same-value guard: resize fires continuously while rotating or dragging a window,
      // and re-rendering the whole shell on every pixel is wasteful when the tier is what
      // actually matters.
      return (prev.tier === next.tier
        && prev.isTouch === next.isTouch
        && prev.isShortViewport === next.isShortViewport
        && prev.showEditorSidePanel === next.showEditorSidePanel) ? prev : next
    })
    sync()
    window.addEventListener('resize', sync)
    // orientationchange fires on tablets/phones before resize settles on some browsers;
    // listening to both means a rotation is never missed.
    window.addEventListener('orientationchange', sync)
    // The keyboard heuristic above depends on which element is focused, and the keyboard's
    // resize event can land before or after focus moves, so re-measure on focus changes too.
    document.addEventListener('focusin', sync, true)
    document.addEventListener('focusout', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      document.removeEventListener('focusin', sync, true)
      document.removeEventListener('focusout', sync, true)
    }
  }, [])

  return bp
}
