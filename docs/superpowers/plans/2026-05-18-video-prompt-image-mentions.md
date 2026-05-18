# Video Prompt Image Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type `@` in the video prompt to pick uploaded reference images and preview linked `@imgN` tokens.

**Architecture:** Keep prompts as plain text. Add local component state in `VideoGeneratePage.tsx` for mention menu visibility and textarea caret position. Use existing reference image previews as the mention source; backend payload remains unchanged.

**Tech Stack:** React, Zustand, Tailwind, existing UI Button/Textarea components.

---

### Task 1: Prompt Mention UI

**Files:**
- Modify: `src/components/video/VideoGeneratePage.tsx`

- [ ] **Step 1: Add textarea ref and mention state**

Use `useRef` and component state:

```ts
const promptRef = useRef<HTMLTextAreaElement | null>(null)
const [mentionOpen, setMentionOpen] = useState(false)
```

- [ ] **Step 2: Add caret insertion helper**

Insert a token at the current textarea selection:

```ts
const insertImageMention = (token: string) => {
  const input = promptRef.current
  if (!input) {
    insertPromptReference(token)
    setMentionOpen(false)
    return
  }
  const start = input.selectionStart
  const end = input.selectionEnd
  const before = prompt.slice(0, start)
  const after = prompt.slice(end)
  const next = `${before}${token} ${after}`
  setPrompt(next)
  setMentionOpen(false)
  requestAnimationFrame(() => {
    input.focus()
    const nextPosition = before.length + token.length + 1
    input.setSelectionRange(nextPosition, nextPosition)
  })
}
```

- [ ] **Step 3: Open menu when user types `@`**

In textarea `onChange`, call `setPrompt(value)` and open the mention menu when `value[event.target.selectionStart - 1] === '@'` and reference images exist.

- [ ] **Step 4: Render mention dropdown**

Render a positioned dropdown below the textarea with each reference image thumbnail and `@imgN`. Selecting an item replaces the just-typed `@` with `@imgN `.

- [ ] **Step 5: Render mention chips**

Below the textarea, render chips for reference images whose token exists in `prompt`. Hovering a chip shows a larger preview using CSS group-hover.

### Task 2: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Vite build succeeds.
