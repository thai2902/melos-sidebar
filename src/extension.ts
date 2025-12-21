import * as vscode from 'vscode';
import { MelosTreeDataProvider, MelosLifecycleDataProvider, ScriptItem } from './melosTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

    const melosScriptProvider = new MelosTreeDataProvider(rootPath);
    const melosLifecycleProvider = new MelosLifecycleDataProvider();

    vscode.window.registerTreeDataProvider('melos-scripts', melosScriptProvider);
    vscode.window.registerTreeDataProvider('melos-lifecycle', melosLifecycleProvider);

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
}

function runCommand(command: string) {
    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Melos');
    terminal.show();
    terminal.sendText(command);
}

export function deactivate() { }
