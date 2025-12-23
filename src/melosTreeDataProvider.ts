import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

    async getChildren(element?: ScriptItem | vscode.TreeItem): Promise<(ScriptItem | vscode.TreeItem)[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        if (element) {
            // If it's the Recommendation Group, return the recommended items
            if (element instanceof vscode.TreeItem && element.label === 'Recommendations') {
                const parser = new MelosParser(this.workspaceRoot);
                const scripts = await parser.parse();
                const existingScriptNames = new Set(scripts.map(s => s.name));

                return RECOMMENDED_SCRIPTS
                    .filter(rec => !existingScriptNames.has(rec.name))
                    .map(rec => {
                        const item = new ScriptItem(
                            rec.name,
                            rec.run,
                            rec.description,
                            vscode.TreeItemCollapsibleState.None
                        );
                        item.command = {
                            command: 'melos.addScript',
                            title: 'Add Script',
                            arguments: [item]
                        };
                        item.contextValue = 'recommendation';
                        item.iconPath = new vscode.ThemeIcon('lightbulb');
                        return item;
                    });
            }
            return [];
        }

        const melosYamlPath = path.join(this.workspaceRoot, 'melos.yaml');
        if (!fs.existsSync(melosYamlPath)) {
            // Return empty array to trigger viewsWelcome
            return [];
        }

        // Top level: scripts
        const parser = new MelosParser(this.workspaceRoot);
        const scripts = await parser.parse();

        // Sort scripts alphabetically
        scripts.sort((a, b) => a.name.localeCompare(b.name));

        const scriptItems: (ScriptItem | vscode.TreeItem)[] = scripts.map(script => new ScriptItem(
            script.name,
            script.run,
            script.description,
            vscode.TreeItemCollapsibleState.None
        ));

        // Check for missing recommendations
        const existingScriptNames = new Set(scripts.map(s => s.name));
        const missingRecommendations = RECOMMENDED_SCRIPTS.filter(rec => !existingScriptNames.has(rec.name));

        if (missingRecommendations.length > 0) {
            const recommendationGroup = new vscode.TreeItem('Recommendations', vscode.TreeItemCollapsibleState.Collapsed);
            recommendationGroup.iconPath = new vscode.ThemeIcon('star');
            recommendationGroup.contextValue = 'recommendationGroup';
            scriptItems.push(recommendationGroup);
        }

        return scriptItems;
    }
}

export const RECOMMENDED_SCRIPTS = [
    {
        name: 'lint',
        run: 'melos run analyze',
        description: 'Run dart analyze in all packages',
        dependencies: ['analyze']
    },
    {
        name: 'analyze',
        run: 'melos exec -- dart analyze .',
        description: 'Run dart analyze in all packages'
    },
    {
        name: 'format',
        run: 'dart format .',
        description: 'Format all code'
    },
    {
        name: 'test',
        run: 'melos run test:select',
        description: 'Run tests interactively',
        dependencies: ['test:select']
    },
    {
        name: 'test:select',
        run: 'melos exec --dir-exists=\"test\" --fail-fast -- flutter test',
        description: 'Run flutter test for selected package'
    },
    {
        name: 'codegen',
        run: 'melos exec -c 1 --depends-on=\"build_runner\" -- flutter pub run build_runner build --delete-conflicting-outputs',
        description: 'Run build_runner in packages that depend on it'
    },
    {
        name: 'fix',
        run: 'melos exec -- dart fix --apply',
        description: 'Apply automatic fixes to all packages'
    },
    {
        name: 'upgrade',
        run: 'melos exec -- flutter pub upgrade',
        description: 'Upgrade dependencies in all packages'
    }
];

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
