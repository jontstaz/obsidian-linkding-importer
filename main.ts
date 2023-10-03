// Import the necessary classes from the Obsidian API
import { Plugin, PluginSettingTab, App, Setting, TFile, Notice, RequestUrlParam, RequestUrlResponse, requestUrl } from 'obsidian';

interface LinkdingImportSettings {
	linkdingInstanceURL: string;
	linkdingAPIKey: string;
	saveBookmarksTo: string;
	updateInterval: number;
	fetchQuery: string;
	fetchLimit: number;
	fetchOffset: number;
}

export default class LinkdingImportPlugin extends Plugin {
	settings: LinkdingImportSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new LinkdingImportSettingTab(this.app, this));

		if (this.settings.updateInterval !== 0) {
			setInterval(this.loadBookmarks.bind(this), this.settings.updateInterval * 60 * 1000);
		}
		
		this.addCommand({
			id: 'fetch-linkding-bookmarks',
			name: 'Fetch Linkding Bookmarks',
			callback: () => this.loadBookmarks()
		  });
	}

	async onunload() {
		await this.saveSettings();
	}

	async loadSettings() {
		this.settings = Object.assign({}, {
			linkdingInstanceURL: "http://192.168.50.203:9090",
			linkdingAPIKey: "",
			saveBookmarksTo: "notes/linkdingnotes",
			updateInterval: 30,
			fetchQuery: "",
			fetchLimit: 100,
			fetchOffset: 0
		}, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadBookmarks() {
		const options: RequestUrlParam = {
			url: `${this.settings.linkdingInstanceURL}/api/bookmarks/?limit=${this.settings.fetchLimit}&offset=${this.settings.fetchOffset}`,
			method: 'GET',
			headers: {
				'Authorization': `Token ${this.settings.linkdingAPIKey}`,
				'Content-Type': 'application/json'
			}
		}
		var response: RequestUrlResponse;
		response = await requestUrl(options);
		const data = response.json;
		new Notice(data);

		let file = this.app.vault.getAbstractFileByPath(this.settings.saveBookmarksTo);
		if (!file) {
			// Create the file if it doesn't exist
			await this.app.vault.create(this.settings.saveBookmarksTo, '');
			file = this.app.vault.getAbstractFileByPath(this.settings.saveBookmarksTo);
		}

		if (!(file instanceof TFile)) {
			console.error('File path points to a directory, not a file:', this.settings.saveBookmarksTo);
			new Notice('Failed!!');
			return;
		}

		for (const bookmark of data.results) {
			let content = "";

			if (bookmark.title && bookmark.title.trim() !== "") {
			content += `## ${bookmark.title} \n`;
			} else {
			content += `## ${bookmark.website_title} \n`;
			}

			content += `### [${bookmark.url}](${bookmark.url}) \n`;

			if (bookmark.description && bookmark.description.trim() !== "") {
			content += `${bookmark.description} \n`;
			}

			if (bookmark.tag_names && bookmark.tag_names.length > 0) {
			content += `Tags: ${bookmark.tag_names.join(' ')} \n\n--- \n`;
			} else {
			content += '\n--- \n';
			}

			await this.app.vault.append(file, content);
		}
	}
}

class LinkdingImportSettingTab extends PluginSettingTab {
	plugin: LinkdingImportPlugin;

	constructor(app: App, plugin: LinkdingImportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Linkding Import Settings' });

		new Setting(containerEl)
			.setName('Linkding Instance URL')
			.setDesc('The URL where your Linkding instance is hosted.')
			.addText(text => text
				.setPlaceholder('Enter the URL...')
				.setValue(this.plugin.settings.linkdingInstanceURL)
				.onChange(async (value) => {
					this.plugin.settings.linkdingInstanceURL = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Linkding API Key')
			.setDesc('Your REST API authentication key to include as an Authorization header in the HTTP request.')
			.addText(text => text
				.setPlaceholder('Enter the API key...')
				.setValue(this.plugin.settings.linkdingAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.linkdingAPIKey = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Search Query (Optional)')
			.setDesc('Filters results using a search phrase using the same logic as through the LinkDing UI.')
			.addText(text => text
				.setPlaceholder('Enter your search query...')
				.setValue(this.plugin.settings.fetchQuery)
				.onChange(async (value) => {
					this.plugin.settings.fetchQuery = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Results Limit')
			.setDesc('Limits the max. number of bookmarks returned. If empty, the default is 100.')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(this.plugin.settings.fetchLimit.toString())
				.onChange(async (value) => {
					let limit = parseInt(value);
					if (!limit) {
						limit = 0;
						new Notice('Results Limit must be a positive number. Defaulting to 100');
					}
					this.plugin.settings.fetchLimit = limit || 100;
					await this.plugin.saveSettings();
				}));
	
		new Setting(containerEl)
			.setName('Offset')
			.setDesc('Index from which to start returning results. If empty, the default is 0.')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(this.plugin.settings.fetchOffset.toString())
				.onChange(async (value) => {
					let offset = parseInt(value);
					if (!offset) {
						offset = 0;
						new Notice('Offset must be a positive number. Defaulting to 0');
					}
					this.plugin.settings.fetchOffset = offset || 0;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File to save bookmarks to')
			.setDesc('The path to the specific Obsidian Note that you want to save the Linkding bookmarks in.')
			.addText(text => text
				.setPlaceholder('Enter the file path...')
				.setValue(this.plugin.settings.saveBookmarksTo)
				.onChange(async (value) => {
					this.plugin.settings.saveBookmarksTo = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Update Interval')
			.setDesc('How often to fetch bookmarks from Linkding (in minutes)? 0 to disable automatic fetching.')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(this.plugin.settings.updateInterval.toString())
				.onChange(async (value) => {
					let interval = parseInt(value);
					if (!interval) {
						interval = 0;
						new Notice('Update Interval must be a positive number. Defaulting to 30');
					}
					this.plugin.settings.updateInterval = interval || 30;
					await this.plugin.saveSettings();
				}));

	}
}