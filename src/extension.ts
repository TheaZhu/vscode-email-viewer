'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extname, basename, join } from 'path';

import { EmailFileSystemProvider } from './EmailFileSystemProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "email-viewer" is now active!');

    // const fileSystemProvider = new EmailFileSystemProvider();
    // const emlDisposable = vscode.workspace.registerFileSystemProvider('eml', fileSystemProvider, {isCaseSensitive: true});
    // const openedDisposable = vscode.workspace.onDidOpenTextDocument(document => tryPreviewEmailDocument(document));

    // context.subscriptions.push(emlDisposable);
    // context.subscriptions.push(openedDisposable);

    // if (vscode.window.activeTextEditor !== undefined) {
    //     tryPreviewEmailDocument(vscode.window.activeTextEditor.document);
    // }
}

function tryPreviewEmailDocument(document: vscode.TextDocument) {
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