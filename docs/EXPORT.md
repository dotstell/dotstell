# Exporting your data

Dotstell never holds your notes hostage. **Settings → Export everything** downloads a single
`dotstell-export-YYYY-MM-DD.zip` of plain files that open in Obsidian, any text editor, a
spreadsheet, or a browser.

## What is in the archive

```
dotstell-export-2026-10-16/
├── README.md                 # a short guide, included in every export
├── dotstell-export.json      # complete, lossless backup of everything
├── notes/
│   ├── Meeting notes.md      # one Markdown file per note
│   └── Work/                 # a notebook becomes a folder
│       └── Quarterly plan.md
├── people/
│   └── Aiko Tanaka.md        # with the notes and tasks linked to them
├── attachments/              # images that were pasted into notes
├── tasks.md                  # readable checklist, grouped by status
├── tasks.csv                 # the same tasks for a spreadsheet
├── bookmarks.md              # readable list
└── bookmarks.html            # imports into Chrome, Firefox, Safari and Edge
```

## Notes

Each note has YAML front matter:

```yaml
---
title: "Quarterly plan"
tags: ["planning", "q4"]
notebook: "Work"
created: "2026-01-01T09:00:00.000Z"
updated: "2026-01-09T17:30:00.000Z"
pinned: true
parent: "[[Roadmap]]"                          # for sub-notes
person: "[[people/Aiko Tanaka|Aiko Tanaka]]"  # a note attached to a person
related: ["[[Budget]]", "task: Ship export"]   # manual links
dotstell_id: "…"                               # lets a future import recognise the note
---
```

- **Wikilinks** (`[[Other note]]`) keep working. File names are unique across the whole export,
  so a bare `[[name]]` is never ambiguous. Titles that collide (for example `Plan` and `plan`)
  become `Plan` and `plan (2)`; links are written to match.
- Characters that are not allowed in file names, or that break Obsidian links (`/ \ : * ? " < > | # ^ [ ]`),
  are replaced with spaces. The real title is kept in the front matter.
- **Checklists**, **tables**, **code blocks**, **highlights** (`==text==`) and **strikethrough** are
  converted to Markdown. Underline, subscript and superscript stay as inline HTML.
- **Images** that were embedded in a note are saved as real files in `attachments/` and linked
  with a relative path. Images that point at a web address are left as links.

## What does not carry over to Markdown

Text colour, font and alignment have no Markdown equivalent, so they are not in the `.md` files.
They are preserved in `dotstell-export.json`. Notes in the trash are not exported, and
semantic-search embeddings are not exported (they are rebuilt from your text).

## The JSON backup

`dotstell-export.json` contains every note (as the editor's HTML), person, task, bookmark,
notebook and link, plus a `format` / `version` header, so it can be re-imported without loss.

## How it works

The export runs in your browser. It reads your data page by page from `GET /api/export`
(`entity`, `offset`, `limit`) and builds the zip locally with [fflate](https://github.com/101arrowz/fflate).
Paging matters: a single request is capped at a few MB by the host and at 1000 rows by the
database, so a one-shot "give me everything" call would quietly drop data for large accounts.
The archive is never stored on a server.

The conversion code is in `src/lib/export/` and is covered by `pnpm test`.
