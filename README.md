<div align="center">
  <img src="https://img.shields.io/github/license/almuzahidseyam/AI-Bridge?style=flat-square&color=blue" alt="License">
  <h1>🌉 AI-Bridge</h1>
  <p><b>Seamlessly transfer AI Chat Contexts between ChatGPT, Claude, and Gemini.</b></p>
</div>

## 🚀 The Problem: Vendor Lock-in
Have you ever started a massive project in ChatGPT, only to realize Claude handles coding better? Manually copying files, prompts, and chat histories across different AIs is a nightmare. 

**AI-Bridge** solves this by letting you extract the "brain" (context) of one AI and inject it directly into another with a single click.

## ✨ Features
* 📦 **Chrome Extension:** 1-click Export & Inject directly from the browser.
* 🐍 **Python Packager CLI:** Bundle actual local workspace files into an AI-readable Zip.
* 🧠 **Mega-Prompt Engineering:** Auto-initializes the receiving AI to resume work without generic greetings.
* 🖥️ **React DOM Hijacking:** Smoothly pastes context into modern AI chatboxes.

## 🛠️ Installation (Chrome Extension)
1. Clone this repository.
2. Go to chrome://extensions/ in your Chrome browser.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the extension folder.

## 💻 Usage (Extension)
1. Open your active chat in ChatGPT or Claude.
2. Click the **AI-Bridge** extension icon and press **Extract Chat Context**.
3. Open a new tab in your target AI (e.g., Claude).
4. Click **Inject into New AI**. The context is instantly pasted! Just hit Send.

---
*Built with ❤️ for Open Source.*

## 📝 License
This project is proudly open-source and licensed under the **MIT License**. Copyright (c) 2026 Muhammad Al-Muzahid.


## 🪄 v3.0 Magic Feature: Auto-Unzip & Inject
No more manual file uploads! 
1. Click **4. Auto-Unzip & Inject ZIP directly!** in the extension.
2. Select your AI-Bridge-Workspace.zip.
3. The extension instantly parses all code files, formats them into a structured XML codebase, and injects EVERYTHING (Code + History) directly into the AI's chatbox.

## ⚡ v4.0 New Feature: Token Optimizer (Context Minifier)
Extracting massive 50,000-word chats crashes AI context limits. 
With v4.0, you can go to **Settings** and set a **Context Limit** (e.g., Keep only the last 10 messages). The extension will automatically trim older messages, preventing AI confusion and saving your token limits!

## 🌍 v5.0 Update: Multi-AI Expansion & Prompt Library
* **Custom Prompts Library**: Go to settings and choose predefined personas like "Web Dev Mode", "Data Science Mode", or "Writer Mode".
* **Multi-AI Support**: Now officially supports extraction and injection across **ChatGPT, Claude, Google Gemini, Perplexity AI, and HuggingFace Chat**.

## 🏗️ v6.0 The Architecture Update
* **Smart Heuristics Engine**: No longer relies purely on hardcoded CSS classes that break when ChatGPT/Claude update their UI. Falls back to a heuristic DOM parser.
* **Safe Markdown Injection**: Workspace code is now injected using Markdown syntax rather than XML, preventing prompt-parsing vulnerabilities if your code contains XML tags.
* **JSZip Progress Tracking**: Added live progress updates so the extension UI doesn't appear frozen on massive ZIP files.
* **Payload Warnings**: Warns users before injecting massively heavy payloads (200KB+) that could momentarily freeze the browser's render thread.
