# Importing notes

**Import & Export → Import** reads Markdown files, Evernote exports, Google Keep exports and contact
files, and creates the notes (and people) in your account. Nothing is saved until you have seen the preview and confirmed, and the
whole import can be undone afterwards.

The file is read in your browser. Only the cleaned-up notes are sent to the server, in small batches.

## Where the files come from

Anything that can export plain Markdown should work. The importer follows the conventions these apps share (front matter, `[[wikilinks]]`, relative links, folders). It is tested with Obsidian-style vaults and with dotstell's own export; the Evernote, Google Keep and contacts readers follow the published formats and are covered by tests built from sample files, but have not yet been run against large real-world exports. Exports vary by app version, so **try a small folder first** and use Undo if something looks off.

| App | How to get the files |
|---|---|
| **Obsidian** | Nothing to export: a vault is already a folder of `.md` files. Choose the vault folder, or zip it. |
| **Logseq** | Choose the graph's `pages` folder. Its outliner bullets import as bullet lists. |
| **Bear**, **Joplin** | Export notes as Markdown, then zip the result. |
| **Notion** | *Settings → Export content → Markdown & CSV*, then choose the downloaded zip. |
| **dotstell** | A zip from *Export everything*. Notes are restored with their notebooks, tags, dates, links and sub-notes. |
| **Evernote** | *File → Export notes…* (or right-click a notebook) and choose **ENEX**. Choose the `.enex` file. Each file becomes a notebook named after the file. |
| **Google Keep** | [Google Takeout](https://takeout.google.com), select only **Keep**, then choose the downloaded zip. Notes go into a "Google Keep" notebook. |
| **Contacts** | Export a `.vcf` (vCard) from your phone or address book, or **Google Contacts → Export → Google CSV / Outlook CSV**. They are added to People. |
| **Anything else** | A folder of `.md` files. |

The app recognises each file by what it contains, so you can drop several kinds at once. A `.csv` is only
treated as contacts when it has a name column plus an email or phone column; any other spreadsheet is skipped.

### What carries over from Evernote, Keep and contacts

- **Evernote:** title, text formatting, links, tables, checklists, images, tags, created and updated
  dates, and the source URL. Not imported: PDFs and other attachments, encrypted text (both are listed
  in the preview), and notebook stacks (every `.enex` file is one notebook).
- **Google Keep:** title, text, checklists, labels (as tags), pinned state, dates, links and images. Notes in
  Keep's trash are skipped. The `.html` copies Takeout adds next to every note are ignored.
- **Contacts:** name, job title, company, one email and one phone number. Addresses, birthdays, notes and
  photos are not stored by dotstell and are left out. People who already exist (same email, or same name
  when there is no email) are skipped, so importing twice does not duplicate anyone.

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
- Evernote files that define XML entities or are damaged (a damaged file is refused whole, not half-read)
- Evernote and Keep images that are not real images, and SVGs that contain scripts

The server repeats the check: a note whose HTML still contains scripts, event handlers or
`javascript:` links is rejected, even if the request did not come from the app.

## Folder prompt

When you press "Choose a folder", the browser asks you to confirm sharing it. That prompt belongs to
the browser and cannot be changed. Dropping a folder onto the card, or choosing a zip, does not show it.

## Undo

Every import is tagged `imported-YYYY-MM-DD-HHMMSS`. **Undo import** moves exactly those notes to the
trash, from where they can be restored. Notebooks created by the import stay (they may be empty).
People added by the import are removed (people have no trash); people who already existed are never touched.

## Limits

Up to 25 MB per file (150 MB for an Evernote `.enex`) and 400 MB in total, and 20,000 files per zip, because everything is read in the browser. Very large vaults
are best imported in a few folders at a time.

## How it works

The browser reads the files (`src/lib/import/`), assigns every note its id up front, and turns each
`[[link]]` into a link to that id, so no second pass over the server is needed. Notes are then
saved by `POST /api/import/notes` (25 per request, parents before children), the wikilink edges by
`POST /api/import/links`, and `POST /api/import/undo` reverses a run. The server re-validates ids,
sizes, tags and that every parent belongs to the signed-in user. Covered by `pnpm test`.
