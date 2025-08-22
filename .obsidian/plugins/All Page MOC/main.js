// =============================
// File: main.js (no-build, drop-in)
// Place under: .obsidian/plugins/all-page-moc/main.js
// =============================
/* global app, Notice */
const { Plugin, Notice, Modal, Setting } = require('obsidian');

class AllPageMOCSettings {
  constructor() {
    this.outputPath = 'All-Vault.md'; // 出力ファイル（Vault相対）
    this.includeContent = false;      // 本文も出力するか（trueで全文結合）
    this.maxBytesPerNote = 2_000_000; // 各ノートの最大読み出しバイト（安全装置）
    this.excludeFolders = '';         // 除外フォルダ（カンマ区切り）
    this.sortMode = 'path';           // 'path' | 'name' | 'mtime' | 'ctime'
    this.headerLevel = 2;             // セクション見出しの#数
    this.showFrontmatter = false;     // フロントマターも出力
  }
}

class AllPageMOC extends Plugin {
  async onload() {
    this.settings = Object.assign(new AllPageMOCSettings(), await this.loadData());

    // コマンド: クイック生成（設定反映）
    this.addCommand({
      id: 'generate-all-page-moc-quick',
      name: 'Generate All Page MOC (Use Settings)',
      callback: () => this.generate(false)
    });

    // コマンド: 生成（オプション指定）
    this.addCommand({
      id: 'generate-all-page-moc-with-options',
      name: 'Generate All Page MOC… (Specify Options)',
      callback: () => this.openGenerateModal()
    });

    // 設定タブ
    this.addSettingTab(new AllPageMOCSettingTab(this.app, this));
  }

  onunload() {}

  async openGenerateModal() {
    const modal = new GenerateModal(this.app, this);
    modal.open();
  }

  // 生成本体
  async generate(silent = false) {
    const s = this.settings;
    const vault = this.app.vault;
    const adapter = vault.adapter;

    const excludes = s.excludeFolders.split(',').map(x => x.trim()).filter(Boolean);

    const all = vault.getMarkdownFiles().filter(f => {
      // 除外フォルダ判定
      if (excludes.length > 0) {
        const path = f.path;
        for (const ex of excludes) {
          if (path.startsWith(ex + '/') || path === ex) return false;
        }
      }
      return true;
    });

    // ソート
    const files = [...all].sort((a, b) => {
      switch (s.sortMode) {
        case 'name': return a.basename.localeCompare(b.basename, undefined, {sensitivity:'base'});
        case 'mtime': return (a.stat?.mtime ?? 0) - (b.stat?.mtime ?? 0);
        case 'ctime': return (a.stat?.ctime ?? 0) - (b.stat?.ctime ?? 0);
        case 'path': default: return a.path.localeCompare(b.path, undefined, {sensitivity:'base'});
      }
    });

    const h = '#'.repeat(Math.max(1, Math.min(6, s.headerLevel)));

    const ts = new Date().toISOString();
    let out = '';
    out += `---\n`;
    out += `title: All Page MOC\n`;
    out += `generated: ${ts}\n`;
    out += `includeContent: ${s.includeContent}\n`;
    out += `sort: ${s.sortMode}\n`;
    out += `exclude: ${s.excludeFolders}\n`;
    out += `---\n\n`;
    out += `> 自動生成: ${ts}\n\n`;

    // 目次（リンク一覧）
    out += `## 目次\n\n`;
    for (const f of files) {
      out += `- [[${f.path}]]\n`;
    }
    out += `\n---\n`;

    const total = files.length;
    let count = 0;

    for (const f of files) {
      count++;
      if (!silent && count % 50 === 0) new Notice(`All Page MOC: ${count}/${total} 生成中…`);

      const sectionTitle = `${h} ${f.basename} \n\n`;
      out += `\n${sectionTitle}`;
      out += `**Path:** [[${f.path}]]  `;
      if (f.stat) {
        out += `**Updated:** ${new Date(f.stat.mtime || 0).toISOString()}  `;
        out += `**Created:** ${new Date(f.stat.ctime || 0).toISOString()}\n\n`;
      } else {
        out += `\n\n`;
      }

      if (s.includeContent) {
        let content = await vault.read(f);
        if (!s.showFrontmatter) {
          // --- frontmatter --- を剥がす
          if (content.startsWith('---')) {
            const end = content.indexOf('\n---', 3);
            if (end !== -1) content = content.slice(end + 4);
          }
        }
        // セーフティ: 大きすぎるノートをカット
        if (new TextEncoder().encode(content).length > s.maxBytesPerNote) {
          const truncated = content.slice(0, s.maxBytesPerNote / 2);
          out += `> **Note:** このノートは大きすぎるため一部のみ出力されています。\n\n`;
          out += truncated + `\n\n`;
        } else {
          out += content + `\n\n`;
        }
        out += `\n---\n`;
      }
    }

    // 書き込み
    const outPath = s.outputPath.trim() || 'All-Vault.md';
    const exists = await adapter.exists(outPath);
    if (exists) {
      await adapter.write(outPath, out);
    } else {
      // 階層が含まれる場合はフォルダを作る
      const dir = outPath.split('/').slice(0, -1).join('/');
      if (dir) {
        try { await adapter.mkdir(dir); } catch (e) {}
      }
      await adapter.write(outPath, out);
    }

    new Notice(`All Page MOC: 出力完了 → ${outPath}`);
  }

  async saveSettings() { await this.saveData(this.settings); }
}

class AllPageMOCSettingTab extends class extends require('obsidian').PluginSettingTab {} {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'All Page MOC Settings' });

    new Setting(containerEl)
      .setName('Output File Path')
      .setDesc('Relative to vault. Example: Export/All-Vault.md')
      .addText(t => t.setPlaceholder('All-Vault.md')
        .setValue(this.plugin.settings.outputPath)
        .onChange(async (v) => { this.plugin.settings.outputPath = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Include Content (Concatenate All)')
      .setDesc('On: concatenate all note contents. Off: only link index.')
      .addToggle(t => t.setValue(this.plugin.settings.includeContent)
        .onChange(async (v) => { this.plugin.settings.includeContent = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Max Bytes per Note')
      .setDesc('Safety limit. Large notes will be truncated.')
      .addText(t => t.setPlaceholder('2000000')
        .setValue(String(this.plugin.settings.maxBytesPerNote))
        .onChange(async (v) => { const n = Number(v)||2000000; this.plugin.settings.maxBytesPerNote = n; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Exclude Folders')
      .setDesc('Comma separated (e.g.: .obsidian, Templates, 99_Trash)')
      .addText(t => t.setPlaceholder('.obsidian, Templates')
        .setValue(this.plugin.settings.excludeFolders)
        .onChange(async (v) => { this.plugin.settings.excludeFolders = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Sort')
      .setDesc('Output order')
      .addDropdown(d => d.addOptions({ path: 'Path', name: 'Name', mtime: 'Modified', ctime: 'Created' })
        .setValue(this.plugin.settings.sortMode)
        .onChange(async (v) => { this.plugin.settings.sortMode = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Section Header Level')
      .setDesc('1–6 (number of #)')
      .addText(t => t.setPlaceholder('2')
        .setValue(String(this.plugin.settings.headerLevel))
        .onChange(async (v) => { const n = Math.min(6, Math.max(1, Number(v)||2)); this.plugin.settings.headerLevel = n; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Include Frontmatter')
      .addToggle(t => t.setValue(this.plugin.settings.showFrontmatter)
        .onChange(async (v) => { this.plugin.settings.showFrontmatter = v; await this.plugin.saveSettings(); }));
  }
}

class GenerateModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Generate All Page MOC' });

    const temp = JSON.parse(JSON.stringify(this.plugin.settings));

    new Setting(contentEl)
      .setName('Include Content (Concatenate All)')
      .addToggle(t => t.setValue(temp.includeContent).onChange(v => temp.includeContent = v));

    new Setting(contentEl)
      .setName('Output File Path')
      .addText(t => t.setValue(temp.outputPath).onChange(v => temp.outputPath = v));

    new Setting(contentEl)
      .setName('Exclude Folders (comma separated)')
      .addText(t => t.setValue(temp.excludeFolders).onChange(v => temp.excludeFolders = v));

    new Setting(contentEl)
      .setName('Sort')
      .addDropdown(d => d.addOptions({ path: 'Path', name: 'Name', mtime: 'Modified', ctime: 'Created' })
        .setValue(temp.sortMode).onChange(v => temp.sortMode = v));

    new Setting(contentEl)
      .setName('Max Bytes per Note')
      .addText(t => t.setValue(String(temp.maxBytesPerNote)).onChange(v => temp.maxBytesPerNote = Number(v)||2000000));

    new Setting(contentEl)
      .setName('Header Level (1-6)')
      .addText(t => t.setValue(String(temp.headerLevel)).onChange(v => temp.headerLevel = Math.min(6, Math.max(1, Number(v)||2))));

    new Setting(contentEl)
      .setName('Include Frontmatter')
      .addToggle(t => t.setValue(temp.showFrontmatter).onChange(v => temp.showFrontmatter = v));

    new Setting(contentEl)
      .addButton(b => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(b => b.setCta().setButtonText('Generate')
        .onClick(async () => {
          Object.assign(this.plugin.settings, temp);
          await this.plugin.saveSettings();
          this.close();
          this.plugin.generate();
        }));
  }
}

module.exports = AllPageMOC;
module.exports = AllPageMOC;
