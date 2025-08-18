// main.js
const {
  App,
  FuzzySuggestModal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFolder
} = require("obsidian");

const DEFAULT_SETTINGS = {
  // Default: exclude "MOC" folder
  excludedFolders: ["MOC"]
};

class ExcludeRandomNotePlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Command
    this.addCommand({
      id: "open-random-note-with-exclude",
      name: "Random note (with excluded folders)",
      callback: () => this.openRandomNote()
    });

    // Ribbon icon
    this.addRibbonIcon("dice", "Random note (with excluded folders)", () =>
      this.openRandomNote()
    );

    // Settings tab
    this.addSettingTab(new ExcludeRandomNoteSettingTab(this.app, this));
  }

  onunload() {}

  getAllMarkdownNotes() {
    return this.app.vault.getMarkdownFiles();
  }

  isExcluded(file) {
    const fpath = file.path;
    return this.settings.excludedFolders.some((folder) => {
      if (!folder) return false;
      const norm = folder.replace(/^[\\/]+|[\\/]+$/g, "");
      if (norm.length === 0) return false;
      return fpath === norm || fpath.startsWith(norm + "/");
    });
  }

  async openRandomNote() {
    const candidates = this.getAllMarkdownNotes().filter((f) => !this.isExcluded(f));

    if (candidates.length === 0) {
      new Notice("No candidates found. Please adjust excluded folders.");
      return;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    await this.app.workspace.getLeaf(true).openFile(pick);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class FolderSuggestModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.root = app.vault.getRoot();
    this.onChooseFolder = onChoose;
    this.setPlaceholder("Select a folder to exclude");
  }

  getItems() {
    const out = [];
    const walk = (folder) => {
      out.push(folder);
      folder.children.forEach((child) => {
        if (child instanceof TFolder) walk(child);
      });
    };
    walk(this.root);
    return out;
  }

  getItemText(item) {
    return item.path || "/";
  }

  onChooseItem(item) {
    this.onChooseFolder(item);
  }
}

class ExcludeRandomNoteSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Exclude Random Note Settings" });

    const listWrapper = containerEl.createDiv({ cls: "exrn-list" });

    const renderList = () => {
      listWrapper.empty();

      if (this.plugin.settings.excludedFolders.length === 0) {
        listWrapper.createEl("p", { text: "No excluded folders." });
      }

      this.plugin.settings.excludedFolders.forEach((path, idx) => {
        const row = new Setting(listWrapper)
          .setName(path || "/")
          .setDesc("Edit the folder path")
          .addText((t) =>
            t
              .setPlaceholder("folder/path")
              .setValue(path)
              .onChange(async (v) => {
                this.plugin.settings.excludedFolders[idx] = v.trim();
                await this.plugin.saveSettings();
              })
          )
          .addExtraButton((btn) =>
            btn
              .setIcon("trash")
              .setTooltip("Remove")
              .onClick(async () => {
                this.plugin.settings.excludedFolders.splice(idx, 1);
                await this.plugin.saveSettings();
                renderList();
              })
          );
        row.settingEl.addClass("exrn-row");
      });
    };

    renderList();

    new Setting(containerEl)
      .setName("Add folder")
      .setDesc("Open a folder selection modal")
      .addButton((btn) =>
        btn
          .setIcon("folder-plus")
          .setButtonText("Select folder")
          .onClick(() => {
            new FolderSuggestModal(this.app, async (folder) => {
              const path = (folder.path || "").replace(/^[\\/]+|[\\/]+$/g, "");
              if (!this.plugin.settings.excludedFolders.includes(path)) {
                this.plugin.settings.excludedFolders.push(path);
                await this.plugin.saveSettings();
                renderList();
              } else {
                new Notice("This folder is already in the exclude list.");
              }
            }).open();
          })
      )
      .addButton((btn) =>
        btn
          .setIcon("dice")
          .setButtonText("Test now")
          .setCta()
          .onClick(() => this.plugin.openRandomNote())
      );

    new Setting(containerEl)
      .setName("Reset to default")
      .setDesc("Reset settings to default (exclude only MOC)")
      .addButton((btn) =>
        btn
          .setIcon("rotate-ccw")
          .setButtonText("Reset")
          .onClick(async () => {
            this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
            await this.plugin.saveSettings();
            renderList();
            new Notice("Settings have been reset.");
          })
      );
  }
}

module.exports = ExcludeRandomNotePlugin;