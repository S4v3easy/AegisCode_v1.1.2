# 🛡️ AegisCode
**The AI-Powered Architectural Gatekeeper**

AegisCode is an elite CLI tool that acts as your automated Senior Staff Engineer. It intercepts your Git commits, scans your diffs against your custom architectural rules using DeepSeek-R1 (or Qwen), and brutally blocks technical debt before it merges into your codebase.

[![npm version](https://badge.fury.io/js/aegiscode.svg)](https://badge.fury.io/js/aegiscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Features
- **Zero-Config AI Analysis**: Analyzes your code instantly using the elite DeepSeek-R1 AI engine via Cloud Proxy.
- **Strict Architectural Enforcement**: Enforces your custom architectural rules, security policies, and code standards.
- **Bring Your Own Key (BYOK)**: Use your own OpenRouter API key for unlimited, unthrottled local scans.
- **Cloud Proxy Protection**: Native integration with `aegiscode.app` to protect tokens and prevent abuse.
- **Lightning Fast**: Terminal-native UI with zero flickering, Cylon scanner animation, and instant feedback.

## 🚀 Installation

Install AegisCode globally via npm:
```bash
npm install -g aegiscode
```

## 🔐 Authentication

You can choose between the Cloud Proxy (Free/Pro) or Bring Your Own Key (BYOK).

**Option A: Cloud Proxy (Free & Pro Tiers)**
```bash
aegis login
```
*Opens your browser to authenticate via GitHub. Free Tier gives you 5 scans/day. Pro Tier ($9.99/mo) gives you 200 scans/day. Upgrade at [aegiscode.app](https://www.aegiscode.app).*

**Option B: BYOK (Bring Your Own Key)**
```bash
aegis auth
```
*Paste your OpenRouter API key. Scans run 100% locally with zero limits. Your key never leaves your machine.*

## 🛠️ Usage

### 1. Initialize AegisCode
Run `init` in your project folder to generate the `aegis.config.json` file. This file acts as the Constitution of your codebase.

```bash
aegis init
```
*AegisCode will auto-detect your tech stack (e.g. Next.js, Express) and use Qwen to generate strict rules tailored to your environment.*

### 2. Scan your Code
Run `scan` to analyze your current uncommitted changes (git diff) against your rules.

```bash
aegis scan
```
AegisCode will read your rules, look at your diff, and give you an instant verdict: **Pass** or **Rejected**, along with detailed architectural feedback.

### 3. Change Strictness Level
Too strict? Too lenient? Adjust the severity on the fly.
```bash
aegis severity
```

### 4. Git Pre-Commit Hook (Coming Soon)
```bash
aegis hook
```
*Automatically runs `aegis scan` before every commit. Blocks the commit if technical debt is detected.*

## 🧠 How it Works
1. AegisCode extracts your current `git diff`.
2. It concatenates the diff with your `aegis.config.json`.
3. If using the Cloud Proxy, it routes through our edge network with dynamic Rate Limiting and System Prompt enforcement.
4. The AI evaluates the code and returns a strict JSON verdict.
5. The CLI parses the verdict and renders a stunning terminal animation, either celebrating your clean code or ruthlessly exposing your technical debt.

---
**Built with 💻 and 🛡️ for developers who care about code quality.**
*Visit [aegiscode.app](https://www.aegiscode.app) for more information.*

<!-- Trigger Bedrock AWS Webhook Test -->
