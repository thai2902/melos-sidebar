import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MelosTreeDataProvider, MelosLifecycleDataProvider, ScriptItem, RECOMMENDED_SCRIPTS } from './melosTreeDataProvider';

// File System Watcher
let melosWatcher: vscode.FileSystemWatcher | undefined;
// Output Channel
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Melos Sidebar');
    outputChannel.appendLine('Melos extension activating...');

    const melosScriptProvider = new MelosTreeDataProvider();
    const melosLifecycleProvider = new MelosLifecycleDataProvider();

    vscode.window.registerTreeDataProvider('melos-scripts', melosScriptProvider);
    vscode.window.registerTreeDataProvider('melos-lifecycle', melosLifecycleProvider);

    // Initial check and watcher setup
    refreshWorkspace(melosScriptProvider);

    // Watch for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        refreshWorkspace(melosScriptProvider);
    });

    vscode.commands.registerCommand('melos-sidebar.refresh', () => melosScriptProvider.refresh());

    vscode.commands.registerCommand('melos-sidebar.runScript', (node: ScriptItem) => {
        runCommand(`melos run ${node.label}`);
    });

    vscode.commands.registerCommand('melos-sidebar.bootstrap', () => {
        runCommand('melos bootstrap');
    });

    vscode.commands.registerCommand('melos-sidebar.clean', () => {
        runCommand('melos clean');
    });

    vscode.commands.registerCommand('melos-sidebar.init', () => {
        outputChannel.appendLine('Command: melos-sidebar.init');
        runCommand('melos init');
    });

    vscode.commands.registerCommand('melos-sidebar.openConfig', () => {
        outputChannel.appendLine('Command: melos-sidebar.openConfig');
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            outputChannel.appendLine('Error: No workspace folders found for openConfig');
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const melosYamlPath = path.join(rootPath, 'melos.yaml');
        if (fs.existsSync(melosYamlPath)) {
            vscode.workspace.openTextDocument(melosYamlPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } else {
            vscode.window.showErrorMessage('melos.yaml not found');
        }
    });

    vscode.commands.registerCommand('melos-sidebar.editScript', (node: ScriptItem) => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const melosYamlPath = path.join(rootPath, 'melos.yaml');
        if (fs.existsSync(melosYamlPath)) {
            vscode.workspace.openTextDocument(melosYamlPath).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const text = doc.getText();
                    const lines = text.split('\n');
                    const scriptPattern = new RegExp(`^\\s*${node.label}:(?:\\s|$)`);
                    for (let i = 0; i < lines.length; i++) {
                        if (scriptPattern.test(lines[i])) {
                            const position = new vscode.Position(i, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                            break;
                        }
                    }
                });
            });
        }
    });

    vscode.commands.registerCommand('melos-sidebar.addScript', async (node: ScriptItem) => {
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

}

function refreshWorkspace(provider: MelosTreeDataProvider) {
    outputChannel.appendLine('Refreshing workspace...');
    const workspaceFolder = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0] : undefined;
    const rootPath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

    if (rootPath) {
        outputChannel.appendLine(`Root path detected: ${rootPath}`);
    } else {
        outputChannel.appendLine('No root path detected.');
    }

    updateContext(rootPath);
    provider.refresh();

    // Dispose existing watcher if any
    if (melosWatcher) {
        melosWatcher.dispose();
        melosWatcher = undefined;
    }

    if (workspaceFolder) { // Use workspaceFolder object for RelativePattern
        outputChannel.appendLine('Creating file watcher for melos.yaml');
        melosWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, 'melos.yaml')
        );
        melosWatcher.onDidCreate(() => {
            outputChannel.appendLine('melos.yaml created');
            updateContext(rootPath);
            provider.refresh();
        });
        melosWatcher.onDidChange(() => {
            outputChannel.appendLine('melos.yaml changed');
            provider.refresh();
        });
        melosWatcher.onDidDelete(() => {
            outputChannel.appendLine('melos.yaml deleted');
            updateContext(rootPath);
            provider.refresh();
        });
    }
}

function updateContext(rootPath: string | undefined) {
    if (rootPath) {
        const melosYamlPath = path.join(rootPath, 'melos.yaml');
        const exists = fs.existsSync(melosYamlPath);
        outputChannel.appendLine(`Updating context: melos:configExists=${exists}`);
        vscode.commands.executeCommand('setContext', 'melos:configExists', exists);
    } else {
        outputChannel.appendLine('Updating context: melos:configExists=false');
        vscode.commands.executeCommand('setContext', 'melos:configExists', false);
    }
}

function runCommand(command: string) {
    outputChannel.appendLine(`Running command: ${command}`);
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
