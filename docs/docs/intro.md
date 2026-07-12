---
title: What is aurora-mp?
sidebar_label: What is aurora-mp?
slug: /
---

<p align="center">
	<img src="https://i.postimg.cc/vZr8prX3/logo-3.png" alt="Aurora Multiplayer" width="160" />
</p>

<p align="center">
Aurora Multiplayer (aurora-mp) is a powerful TypeScript framework that lets you write a single codebase for GTA servers and gamemodes on platforms like RAGE MP, and FiveM.
</p>

<p align="center">
	<a href="#"><img src="https://img.shields.io/badge/⚠️-Early%20Development-yellow?style=for-the-badge" alt="Early Development"/></a>
</p>

> This project is still in its infancy. It’s under active development, and not all platforms are supported yet.

## 🚀 Overview

Aurora Multiplayer abstracts away the differences between popular GTA multiplayer platforms (such as FiveM, RAGE MP ...) so you can write one single, strongly-typed codebase that runs on all of them.
With built-in dependency injection, an event-driven architecture, and first-class TypeScript support, you spend less time wrestling with platform quirks and more time crafting immersive multiplayer experiences.

## 🔑 Key Features

- **Cross-Platform**  
  Write your game logic once and deploy it to FiveM or RAGE MP, and any other supported runtimes without changing a single line of business code.

- **Modular Design**  
  Break your code into self-contained modules for core, client, server, and custom webviews—each managed by Aurora’s powerful module loader.

- **Event-Driven**  
  React to player actions, network events, and custom triggers via concise TypeScript decorators like `@OnServer`, `@OnClient`, and `@OnWebview`.

- **Type-Safe APIs**  
  Enjoy fully-typed interfaces for all core services (dependency injection, configuration, logging, webviews), with autocomplete and compile-time checks.

- **Webview Integration**  
  Build rich in-game UIs using standard web technologies (HTML/CSS/JS) and communicate seamlessly with your server and client-side code.

## 🌍 Supported Platforms

Aurora Multiplayer currently provides first-class support for the following multiplayer platforms:

- **FiveM** (Not yet) – Community-driven GTA V multiplayer mod with a massive ecosystem (experimental support via plugins).
- **RAGE MP** (WIP) – A widely-used modding platform for GTA V, praised for its stability and extensive feature set.
- **Other Runtimes** – Easily extendable: create adapters for any GTA multiplayer environment of your choice.

## 📖 Where to start

New to Aurora? Read the docs in this order:

1. **[Requirements](/getting-started/requirements)** and **[Installation](/getting-started/installation)** – get a project scaffolded (or add the packages manually).
2. **[Quickstart](/getting-started/quickstart)** – build a running server that logs a client event, end to end.
3. **[Fundamentals](/fundamentals/providers)** – the concepts every gamemode uses. Read in sidebar order:
   1. [Providers & DI](/fundamentals/providers)
   2. [Built-in services](/fundamentals/built-in-services)
   3. [Modules](/fundamentals/modules)
   4. [Controllers & events](/fundamentals/controllers)
   5. [Guards](/fundamentals/guards)
   6. [Lifecycle hooks](/fundamentals/lifecycle-hooks)
   7. [RPC](/fundamentals/rpc)
4. Then dip into whichever subsystem you need: **[Players](/players/overview)**, **[WebViews](/webviews/overview)**.
5. The **[API reference](/api/core)** is auto-generated from source and covers every exported symbol.

If you just want a quick lookup, the API reference is fine to jump straight into.

# WIP
