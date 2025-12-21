import * as vscode from 'vscode';
import * as path from 'path';
import { MelosParser, MelosScript } from './melosParser';

export class MelosTreeDataProvider implements vscode.TreeDataProvider<ScriptItem | vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<ScriptItem | vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ScriptItem | vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ScriptItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ScriptItem): Promise<(ScriptItem | vscode.TreeItem)[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        if (element) {
            return [];
        }

        // Top level: scripts
        const parser = new MelosParser(this.workspaceRoot);
        const scripts = await parser.parse();

        // Sort scripts alphabetically
        scripts.sort((a, b) => a.name.localeCompare(b.name));

        return scripts.map(script => new ScriptItem(
            script.name,
            script.run,
            script.description,
            vscode.TreeItemCollapsibleState.None
        ));
    }
}

export class ScriptItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly scriptCommand: string,
        public readonly descriptionString: string | undefined,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}: ${this.scriptCommand}`;
        this.description = this.descriptionString;
        this.contextValue = 'script';
        this.command = {
            command: 'melos.runScript',
            title: 'Run Script',
            arguments: [this]
        };
        this.iconPath = new vscode.ThemeIcon('play');
    }
}

// Lifecycle Provider (for the generic commands)
export class MelosLifecycleDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const bootstrap = new vscode.TreeItem('Bootstrap', vscode.TreeItemCollapsibleState.None);
        bootstrap.command = { command: 'melos.bootstrap', title: 'Bootstrap' };
        bootstrap.iconPath = new vscode.ThemeIcon('sync');

        const clean = new vscode.TreeItem('Clean', vscode.TreeItemCollapsibleState.None);
        clean.command = { command: 'melos.clean', title: 'Clean' };
        clean.iconPath = new vscode.ThemeIcon('trash');

        return Promise.resolve([bootstrap, clean]);
    }
}
