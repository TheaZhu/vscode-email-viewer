'use strict';

import * as vscode from 'vscode';
import { extname, basename, join } from 'path';

import { EmailFileSystemProvider } from './EmailFileSystemProvider';

export function activate(context: vscode.ExtensionContext) {

    const fileSystemProvider = new EmailFileSystemProvider();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('eml', fileSystemProvider, {isCaseSensitive: true}));
    context.subscriptions.push(vscode.commands.registerCommand('extension.previewEml', () => {
        let previewDocument = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document || undefined;
        tryPreviewEmailDocument(previewDocument);
    }));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => tryPreviewEmailDocument(document)));

    if (vscode.window.activeTextEditor !== undefined) {
        tryPreviewEmailDocument(vscode.window.activeTextEditor.document);
    }
}

function tryPreviewEmailDocument(document: vscode.TextDocument | undefined) {
    if (!document) {
        return;
    }
    let path = document.uri.path;
    if (path.endsWith('.git')) {
        path = path.substr(0, path.length-4);
    }
    const extension = extname(path).substr(1).toLowerCase();
    switch (document.uri.scheme) {
        case 'file': {
            if (extension !== 'eml') {
                return;
            }

            const path = vscode.workspace.asRelativePath(document.uri, true);
            const uri = vscode.Uri.parse(`${extension}:${path}`);
            const name = basename(document.uri.path);
            if (vscode.workspace.getWorkspaceFolder(uri) === undefined) {
                vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, 0, { uri, name });
            }

            // Preview by opening the index HTML document in the email with leading slash (required by VS Code)
            const previewUri = vscode.Uri.parse(`${extension}:/${join(path, basename(vscode.workspace.asRelativePath(document.uri), extension) + 'html')}`);
            vscode.commands.executeCommand('vscode.previewHtml', previewUri);
            break;
        }
        case 'eml': {
            vscode.commands.executeCommand('vscode.previewHtml', document.uri);

            break;
        }
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
}