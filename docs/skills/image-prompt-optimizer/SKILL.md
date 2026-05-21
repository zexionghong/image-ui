---
name: image-prompt-optimizer
description: Use when adding or changing image-generation flows in this repository that should interpret user intent and improve prompts before calling a model
---

# Image Prompt Optimizer

## Overview

This repository optimizes image prompts on the server before calling a generation model. The optimizer is an enhancement layer, not a separate user workflow.

## Rules

- Preserve the user's subject, intent, and requested change.
- Do not invent a different scene, subject, or style unless the input clearly implies it.
- If reference images are present, treat them as identity and composition anchors.
- For image-to-image flows, change only the requested parts and keep the same core subject unless the user explicitly asks otherwise.
- Keep negative prompts concise and relevant.
- If optimization fails, fall back to the original prompt instead of blocking generation.
- Reuse `server/promptOptimizer.ts` from image routes and workflow execution instead of duplicating prompt-rewrite logic.

## When Updating Flows

- Add optimization metadata to response payloads when the UI needs to explain how the prompt was interpreted.
- Persist original and optimized prompt details in existing metadata fields when possible before adding schema changes.
- Keep optimization display secondary to the main generation result so the generate workflow stays fast and simple.
