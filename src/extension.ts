import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MelosTreeDataProvider, MelosLifecycleDataProvider, ScriptItem, RECOMMENDED_SCRIPTS } from './melosTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

    const melosScriptProvider = new MelosTreeDataProvider(rootPath);
    const melosLifecycleProvider = new MelosLifecycleDataProvider();

    vscode.window.registerTreeDataProvider('melos-scripts', melosScriptProvider);
    vscode.window.registerTreeDataProvider('melos-lifecycle', melosLifecycleProvider);

    // Initial context check
    updateContext(rootPath);

    vscode.commands.registerCommand('melos.refresh', () => melosScriptProvider.refresh());

    vscode.commands.registerCommand('melos.runScript', (node: ScriptItem) => {
        runCommand(`melos run ${node.label}`);
    });

    vscode.commands.registerCommand('melos.bootstrap', () => {
        runCommand('melos bootstrap');
    });

    vscode.commands.registerCommand('melos.clean', () => {
        runCommand('melos clean');
    });

    vscode.commands.registerCommand('melos.init', () => {
        runCommand('melos init');
    });

    vscode.commands.registerCommand('melos.addScript', async (node: ScriptItem) => {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const melosYamlPath = path.join(rootPath, 'melos.yaml');

        if (!fs.existsSync(melosYamlPath)) {
            vscode.window.showErrorMessage('melos.yaml not found');
            return;
        }

        try {
            const fileContent = fs.readFileSync(melosYamlPath, 'utf8');
            let lines = fileContent.split('\n');
            let scriptIndex = -1;

            // Simple check for "scripts:"
            const scriptsRegex = /^scripts:\s*(?:#.*)?$/;
            for (let i = 0; i < lines.length; i++) {
                if (scriptsRegex.test(lines[i].trim())) {
                    scriptIndex = i;
                    break;
                }
            }

            // Determine which scripts to add (including dependencies)
            const scriptsToAdd: any[] = [];
            const scriptNamesToAdd = new Set<string>();

            const addDependencies = (scriptName: string) => {
                const recommended = RECOMMENDED_SCRIPTS.find(s => s.name === scriptName);
                if (recommended && !scriptNamesToAdd.has(scriptName)) {
                    scriptNamesToAdd.add(scriptName);
                    // Add this script
                    scriptsToAdd.push(recommended);
                    // Check dependencies
                    if (recommended.dependencies) {
                        recommended.dependencies.forEach(dep => addDependencies(dep));
                    }
                }
            }

            addDependencies(node.label);

            const newLines: string[] = [];
            scriptsToAdd.forEach(script => {
                // Check if already exists in file content to avoid duplication
                // This is a naive check; a full YAML parse would be safer but complex for edits.
                // Assuming tree view already filters out existing ones, but dependencies might exist.
                const scriptPattern = new RegExp(`^\\s*${script.name}:(?:\\s|$)`);
                const exists = lines.some(line => scriptPattern.test(line));

                if (!exists) {
                    newLines.push(`  ${script.name}:`);
                    newLines.push(`    run: ${script.run}`);
                    newLines.push(`    description: ${script.description}`);
                }
            });

            if (newLines.length > 0) {
                if (scriptIndex !== -1) {
                    // Insert after scripts:
                    lines.splice(scriptIndex + 1, 0, ...newLines);
                } else {
                    // Append to end
                    lines.push('scripts:');
                    lines.push(...newLines);
                }

                fs.writeFileSync(melosYamlPath, lines.join('\n'));
                // Refreshed by the watcher, but manual refresh ensures immediate UI update
                melosScriptProvider.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to add script to melos.yaml');
        }
    });

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], 'melos.yaml')
        );
        watcher.onDidCreate(() => {
            updateContext(rootPath);
            melosScriptProvider.refresh();
        });
        watcher.onDidChange(() => {
            melosScriptProvider.refresh();
        });
        watcher.onDidDelete(() => {
            updateContext(rootPath);
            melosScriptProvider.refresh();
        });
        context.subscriptions.push(watcher);
    }
}

function updateContext(rootPath: string | undefined) {
    if (rootPath) {
        const melosYamlPath = path.join(rootPath, 'melos.yaml');
        const exists = fs.existsSync(melosYamlPath);
        vscode.commands.executeCommand('setContext', 'melos:configExists', exists);
    } else {
        vscode.commands.executeCommand('setContext', 'melos:configExists', false);
    }
}

function runCommand(command: string) {
    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Melos');
    terminal.show();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        // Ensure we run in the workspace root
        terminal.sendText(`cd "${rootPath}"`);
    }
    terminal.sendText(command);
}

export function deactivate() { }
