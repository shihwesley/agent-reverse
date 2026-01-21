# AgentReverse Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy `@shihwesley/agent-reverse` to npm with automated CI/CD publishing.

**Architecture:** npm public registry + GitHub Actions for tag-based automated publishing.

**Tech Stack:** npm, GitHub Actions, Node.js 20

---

## Phase 1: npm Account Setup

### Task 1.1: Create npm Account

**Step 1:** Go to https://www.npmjs.com/signup

**Step 2:** Create account with:
- Username: `shihwesley`
- Email: your email
- Password: secure password

**Step 3:** Verify email (check inbox, click verification link)

**Step 4:** Verify account created

Run: Visit https://www.npmjs.com/~shihwesley
Expected: Profile page loads

---

### Task 1.2: Generate npm Access Token

**Step 1:** Login to https://www.npmjs.com

**Step 2:** Click profile icon (top right) → "Access Tokens"

**Step 3:** Click "Generate New Token" → Select "Classic Token"

**Step 4:** Select type: **Automation** (for CI/CD)

**Step 5:** Copy the token (starts with `npm_...`)

**Step 6:** Save token temporarily (you'll need it for GitHub)

---

## Phase 2: GitHub Repository Setup

### Task 2.1: Create GitHub Repository

**Step 1:** Go to https://github.com/new

**Step 2:** Create repository:
- Name: `agent-reverse`
- Visibility: Public
- No README (we have one)

**Step 3:** Add remote and push

```bash
cd /Users/quartershots/Source/agent-reverse
git remote add origin https://github.com/shihwesley/agent-reverse.git
git branch -M main
git push -u origin main
```

---

### Task 2.2: Add npm Token as GitHub Secret

**Step 1:** Go to repo Settings → Secrets and variables → Actions

**Step 2:** Click "New repository secret"

**Step 3:** Configure secret:
- Name: `NPM_TOKEN`
- Value: paste your npm token from Task 1.2

**Step 4:** Click "Add secret"

---

## Phase 3: Package Configuration

### Task 3.1: Update package.json for Publishing

**Files:**
- Modify: `package.json`

**Step 1:** Update package.json with publishing config

Change `name` and add publishing fields:

```json
{
  "name": "@shihwesley/agent-reverse",
  "version": "0.1.0",
  "description": "Surgical integration tool - extract features from agent plugins without bloat",
  "type": "module",
  "main": "dist/server.js",
  "bin": {
    "agent-reverse": "dist/cli.js",
    "agent-reverse-server": "dist/server.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/shihwesley/agent-reverse.git"
  },
  "bugs": {
    "url": "https://github.com/shihwesley/agent-reverse/issues"
  },
  "homepage": "https://github.com/shihwesley/agent-reverse#readme",
  "keywords": [
    "mcp",
    "model-context-protocol",
    "agent",
    "skills",
    "claude",
    "cursor",
    "reverse-engineering"
  ],
  "author": "shihwesley",
  "license": "MIT"
}
```

**Step 2:** Verify build works

Run: `npm run build`
Expected: `dist/` folder created with compiled JS

**Step 3:** Commit

```bash
git add package.json
git commit -m "chore: configure package for npm publishing"
```

---

### Task 3.2: Add LICENSE File

**Files:**
- Create: `LICENSE`

**Step 1:** Create MIT license file

```
MIT License

Copyright (c) 2025 shihwesley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2:** Commit

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

### Task 3.3: Add Shebang to CLI Entry

**Files:**
- Modify: `src/cli.ts`

**Step 1:** Add shebang to top of cli.ts (if not present)

First line should be:
```typescript
#!/usr/bin/env node
```

**Step 2:** Rebuild

Run: `npm run build`

**Step 3:** Commit

```bash
git add src/cli.ts
git commit -m "chore: add shebang for CLI executable"
```

---

## Phase 4: GitHub Actions Workflow

### Task 4.1: Create Publish Workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1:** Create workflow directory

```bash
mkdir -p .github/workflows
```

**Step 2:** Create publish workflow

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 3:** Commit

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow"
```

---

### Task 4.2: Create CI Test Workflow (Optional but Recommended)

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1:** Create CI workflow for PRs and pushes

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build
```

**Step 2:** Commit

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build verification workflow"
```

---

## Phase 5: First Release

### Task 5.1: Push All Changes to GitHub

**Step 1:** Push main branch

```bash
git push origin main
```

**Step 2:** Verify CI passes

Go to: https://github.com/shihwesley/agent-reverse/actions
Expected: CI workflow runs and passes

---

### Task 5.2: Create and Push Version Tag

**Step 1:** Ensure version in package.json is correct (0.1.0)

**Step 2:** Create annotated tag

```bash
git tag -a v0.1.0 -m "Initial public release"
```

**Step 3:** Push tag to trigger publish

```bash
git push origin v0.1.0
```

**Step 4:** Monitor GitHub Actions

Go to: https://github.com/shihwesley/agent-reverse/actions
Expected: Publish workflow runs and completes successfully

---

### Task 5.3: Verify npm Package

**Step 1:** Check package page

Visit: https://www.npmjs.com/package/@shihwesley/agent-reverse
Expected: Package page shows with README

**Step 2:** Test installation

```bash
npx @shihwesley/agent-reverse --help
```
Expected: CLI help output

**Step 3:** Test MCP server

```bash
npx @shihwesley/agent-reverse-server
```
Expected: MCP server starts (waiting for stdio input)

---

## Phase 6: Documentation Update

### Task 6.1: Update README with Installation Instructions

**Files:**
- Modify: `README.md`

**Step 1:** Add installation section after the intro

```markdown
## Installation

### As MCP Server (Claude Code)

```bash
claude mcp add --transport stdio agent-reverse -- npx -y @shihwesley/agent-reverse-server
```

### As CLI

```bash
# One-off usage
npx @shihwesley/agent-reverse analyze https://github.com/some/repo

# Global install
npm install -g @shihwesley/agent-reverse
agent-reverse --help
```
```

**Step 2:** Commit and push

```bash
git add README.md
git commit -m "docs: add installation instructions"
git push origin main
```

---

## Summary

**Deliverables:**
- npm package: `@shihwesley/agent-reverse`
- Automated publishing via GitHub Actions on version tags
- Two entry points: CLI (`agent-reverse`) and MCP server (`agent-reverse-server`)

**Publishing new versions:**
```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Push with tags
git push origin main --tags

# GitHub Actions automatically publishes to npm
```

**User installation:**
```bash
# MCP Server
claude mcp add --transport stdio agent-reverse -- npx -y @shihwesley/agent-reverse-server

# CLI
npx @shihwesley/agent-reverse analyze <url>
```

---

## Checklist

- [ ] npm account created (shihwesley)
- [ ] npm access token generated
- [ ] GitHub repo created (shihwesley/agent-reverse)
- [ ] NPM_TOKEN secret added to GitHub
- [ ] package.json updated
- [ ] LICENSE file added
- [ ] Shebang added to cli.ts
- [ ] GitHub Actions workflows created
- [ ] First release tagged and published
- [ ] README updated with install instructions
- [ ] Verified package works via npx
