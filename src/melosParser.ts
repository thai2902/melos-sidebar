import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface MelosScript {
    name: string;
    run: string;
    description?: string;
}

export class MelosParser {
    constructor(private workspaceRoot: string) { }

    public async parse(): Promise<MelosScript[]> {
        const melosYamlPath = path.join(this.workspaceRoot, 'melos.yaml');

        if (!fs.existsSync(melosYamlPath)) {
            return [];
        }

        try {
            const fileContent = fs.readFileSync(melosYamlPath, 'utf8');
            const document = yaml.load(fileContent) as any;

            if (!document || !document.scripts) {
                return [];
            }

            const scripts: MelosScript[] = [];
            for (const key of Object.keys(document.scripts)) {
                const scriptNode = document.scripts[key];
                let runCommand = '';
                let description = '';

                if (typeof scriptNode === 'string') {
                    runCommand = scriptNode;
                } else if (typeof scriptNode === 'object') {
                    runCommand = scriptNode.run || '';
                    description = scriptNode.description || '';
                }

                scripts.push({
                    name: key,
                    run: runCommand,
                    description: description
                });
            }

            return scripts;
        } catch (error) {
            console.error('Error parsing melos.yaml:', error);
            vscode.window.showErrorMessage('Error parsing melos.yaml');
            return [];
        }
    }
}
