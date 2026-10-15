# Importing notes

**Import & Export → Import notes** reads a zip (or a folder) of Markdown files and creates the
notes in your account. Nothing is saved until you have seen the preview and confirmed, and the
whole import can be undone afterwards.

The file is read in your browser. Only the cleaned-up notes are sent to the server, in small batches.

## Where the files come from

Anything that can export plain Markdown should work. The importer follows the conventions these apps share (front matter, `[[wikilinks]]`, relative links, folders). It is tested with Obsidian-style vaults and with dotstell's own export; exports from the other apps vary by version, so **try a small folder first** and use Undo if something looks off.

| App | How to get the files |
|---|---|
| **Obsidian** | Nothing to export: a vault is already a folder of `.md` files. Choose the vault folder, or zip it. |
| **Logseq** | Choose the graph's `pages` folder. Its outliner bullets import as bullet lists. |
| **Bear**, **Joplin** | Export notes as Markdown, then zip the result. |
| **Notion** | *Settings → Export content → Markdown & CSV*, then choose the downloaded zip. |
| **dotstell** | A zip from *Export everything*. Notes are restored with their notebooks, tags, dates, links and sub-notes. |
| **Anything else** | A folder of `.md` files. |

Evernote (`.enex`), Google Keep and contacts (vCard / CSV) are not supported yet.

## What is imported

- **One note per `.md` file.** The title is the file name, or the `title` property if there is one.
  Notion's trailing 32-character ids are removed from titles and notebook names.
- **Notebooks.** The first folder level becomes a notebook. Files at the top level are not in a notebook.
- **Tags.** From the `tags` property (a list, or comma/space separated) and from inline `#tags`.
  Tags inside code blocks, URLs and headings are ignored. Nested tags such as `#project/alpha` are kept.
- **Dates and pinning.** `created`, `updated` (or `date`, `modified`) and `pinned` properties are read.
  Otherwise the note is dated at the time of import.
- **Links.** `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, aliases from the `aliases` property, and
  relative Markdown links between notes (the way Notion, Bear and Joplin write them) all become dotstell
  wikilinks, so backlinks and the graph work. When two notes share a name, the one in the same
  folder (or the shortest path) wins. Links to notes that are not in the import stay as plain `[[text]]`.
- **Sub-notes.** A `parent: "[[Note]]"` property nests the note under its parent.
- **Formatting.** Headings, lists, task lists, tables, code blocks, quotes, `==highlights==`,
  `~~strikethrough~~`. Obsidian callouts become quotes with a bold title; `%%comments%%` and block ids
  (`^abc123`) are removed.
- **Images.** Images referenced from a note are stored inside the note, up to 500 KB each. Larger ones,
  and images that cannot be found, are left out and listed in the preview.

## What is not imported

PDFs, audio, video, canvases and database views are skipped (counted in the preview). Embedded notes
(`![[Other note]]`) become links. Raw HTML is shown as text, apart from `<u>`, `<sub>`, `<sup>`,
`<mark>` and `<br>`, and links with unsafe addresses (such as `javascript:`) are removed, because
imported files are not trusted.

## Files that are refused

Imported files are treated as untrusted. These are never opened or saved, and the preview lists them
under "Refused for your safety" (the rest of the import can still go ahead):

- program and script files (`.exe`, `.sh`, `.bat`, `.js`, `.html` and similar)
- files whose contents do not match their name: a "PNG" that is not an image, a `.md` that is binary
- SVG images that contain scripts or external references
- zip files inside the zip (extract them and import the folder instead)
- paths that try to leave the import (`../x` or a drive letter)
- notes over 2 MB, which the server would reject

The server repeats the check: a note whose HTML still contains scripts, event handlers or
`javascript:` links is rejected, even if the request did not come from the app.

## Folder prompt

When you press "Choose a folder", the browser asks you to confirm sharing it. That prompt belongs to
the browser and cannot be changed. Dropping a folder onto the card, or choosing a zip, does not show it.

## Undo

Every import is tagged `imported-YYYY-MM-DD-HHMMSS`. **Undo import** moves exactly those notes to the
trash, from where they can be restored. Notebooks created by the import stay (they may be empty).

## Limits

Up to 25 MB per file and 400 MB per zip, because everything is read in the browser. Very large vaults
are best imported in a few folders at a time.

## How it works

The browser reads the files (`src/lib/import/`), assigns every note its id up front, and turns each
`[[link]]` into a link to that id, so no second pass over the server is needed. Notes are then
saved by `POST /api/import/notes` (25 per request, parents before children), the wikilink edges by
`POST /api/import/links`, and `POST /api/import/undo` reverses a run. The server re-validates ids,
sizes, tags and that every parent belongs to the signed-in user. Covered by `pnpm test`.
