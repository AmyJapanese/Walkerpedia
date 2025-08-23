---
title: "<% tp.file.title %>"
# ファイル名をスラッグ化（半角英数・ハイフン以外を除去、空白→-）
slug: "<% tp.user.slug %>"
date: "<% tp.date.now('YYYY-MM-DD') %>"
draft: true
type: "wiki"
summary: ""
description: ""

# タクソノミー（必要なものだけ使えばOK）
tags: []
characters: []
places: []
items: []
concepts: []
orgs: []
sources: []
writings: []

aliases: []
images: []
weight: 0
---
<%*
let s = tp.file.title.toLowerCase()
  .normalize('NFKD').replace(/[^\w\s-]/g,'')
  .replace(/\s+/g,'-')
  .replace(/-+/g,'-')
  .replace(/^[-_]+|[-_]+$/g,'');
if (!s) s = tp.date.now('YYYYMMDDHHmmss');
tR = s;
%>