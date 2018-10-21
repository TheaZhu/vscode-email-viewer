import { 
    FileSystemProvider,
    Event,
    EventEmitter,
    FileChangeEvent,
    Uri,
    Disposable,
    FileStat,
    FileType,
    workspace
} from 'vscode';
import { extname, basename, join, sep } from 'path';
import * as fs from 'fs-extra';
import { simpleParser } from 'mailparser';
import * as prettyBytes from 'pretty-bytes';

export type Email = {
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments: {
        name: string;
        size: number;
        content: Buffer;
    }[];
    ctime: number;
    mtime: number;
    size: number;
};

export class EmailFileSystemProvider implements FileSystemProvider {
    private emitter = new EventEmitter<FileChangeEvent[]>();

    static loadEml(path: string): Promise<Email> {
        return new Promise<Email>(async (resolve, reject) => {
            try {
                simpleParser(await fs.readFile(path), async (err, mail) => {
                    if (err) {
                        reject(err);
                        return;
                    }
    
                    const { ctime, mtime, size } = await fs.stat(path);
                    const email: Email = {
                        from: mail.from.html,
                        to: mail.to.html,
                        subject: mail.subject,
                        html: mail.html as string | false || mail.textAsHtml || mail.text,
                        attachments: (mail.attachments || []).map(attachment => ({
                            name: attachment.filename!,
                            size: attachment.size,
                            content: attachment.content,
                        })),
                        ctime: ctime.valueOf(),
                        mtime: mtime.valueOf(),
                        size,
                    };
    
                    resolve(email);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    readonly onDidChangeFile: Event<FileChangeEvent[]> = this.emitter.event;

    watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): Disposable {
        return new class {
            dispose() {
                debugger;
            }
        };
    }

    async stat(uri: Uri): Promise<FileStat> {
        const paths = await this.split(uri);
        if (paths === undefined) {
            return { type: FileType.Unknown, ctime: Date.now(), mtime: Date.now(), size: 0 };
        }

        const { absolutePath, extension, relativePath } = paths;

        const email = await this.cache(absolutePath);
        if (email === undefined) {
            return { type: FileType.Unknown, ctime: Date.now(), mtime: Date.now(), size: 0 };
        }

        const { ctime, mtime, size } = email;

        if (relativePath === '.') {
            return { type: FileType.Directory, ctime, mtime, size };
        }

        const index = basename(absolutePath, extension) + 'html';
        if (relativePath === index) {
            return { type: FileType.File, ctime, mtime, size };
        }

        const attachment = email.attachments.find(attachment => attachment.name === relativePath);
        if (attachment !== undefined) {
            return { type: FileType.File, ctime, mtime, size: attachment.size };
        }

        return { type: FileType.Unknown, ctime: Date.now(), mtime: Date.now(), size: 0 };
    }

    async readDirectory(uri: Uri): Promise<[string, FileType][]> {
        const paths = await this.split(uri);
        if (paths === undefined) {
            return [];
        }

        const { absolutePath, extension, relativePath } = paths;

        const email = await this.cache(absolutePath);
        if (email === undefined) {
            return [];
        }

        if (relativePath === '.') {
            const index = basename(absolutePath, extension) + 'html';
            const entries: [string, FileType][] = [];
            const names = new Set();

            names.add(index);
            entries.push([index, FileType.File]);

            for (const attachment of email.attachments) {
                if (attachment.name === undefined) {
                    throw new Error('Does not support attachments without file names');
                }

                if (names.has(attachment.name)) {
                    throw new Error('Does not support multiple attachments with the same file names');
                }

                names.add(attachment.name);
                entries.push([attachment.name, FileType.File]);
            }

            return entries;
        }

        return [];
    }

    createDirectory(uri: Uri): void | Thenable<void> {
        console.log('createDirectory');
    }

    async readFile(uri: Uri): Promise<Uint8Array> {
        const paths = await this.split(uri);
        if (paths === undefined) {
            return Buffer.from([]);
        }

        const { absolutePath, extension, relativePath } = paths;

        const email = await this.cache(absolutePath);
        if (email === undefined) {
            return Buffer.from([]);
        }

        const index = basename(absolutePath, extension) + 'html';
        if (relativePath === index) {
            let html = `<i>From</i>: ${email.from}<br/>`;
            html += `<i>To</i>: ${email.to}<br/>`;
            html += `<br/><i>Subject</i>: <strong>${email.subject}</strong><br/><br/><hr />`;
            if (email.attachments.length > 0) {
                for (const attachment of email.attachments) {
                    const href = `${extension}:/${workspace.asRelativePath(absolutePath)}/${attachment.name}`;
                    html += `<a href='${href}'>${attachment.name} (${prettyBytes(attachment.size)})</a>; `;
                }

                html += '<hr />';
            }

            html += email.html;
            return Buffer.from(html);
        }

        const attachment = email.attachments.find(attachment => attachment.name === relativePath);
        if (attachment !== undefined) {
            return attachment.content;
        }

        return Buffer.from([]);
    }

    writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void> {
        console.log('writeFile');
    }

    delete(uri: Uri, options: { recursive: boolean }): void | Thenable<void> {
        console.log('delete');
    }

    rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void | Thenable<void> {
        console.log('rename');
    }

    async split(uri: Uri): Promise<{ absolutePath: string; extension: 'eml' | 'msg'; relativePath: string; } | undefined> {
        if (workspace.workspaceFolders === undefined) {
            return;
        }

        const absolutePart = this.break(workspace.workspaceFolders[0].uri.path);
        const relativePart = this.break(uri.path);

        if (absolutePart.pop() /* Workspace directory name */ !== relativePart[0]) {
            return undefined;
        }

        let filePath = '';
        const components = [...absolutePart, ...relativePart];
        let component: string | undefined;
        while ((component = components.shift()) !== undefined) {
            filePath += component;
            try {
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    const extension = extname(filePath).substr(1).toLowerCase();
                    if (extension === 'eml' || extension === 'msg') {
                        return { absolutePath: filePath, extension, relativePath: join(...components) };
                    } else {
                        return;
                    }
                } else if (stat.isDirectory()) {
                    filePath += sep;
                } else {
                    debugger;
                    return;
                }
            } catch (error) {
                return;
            }
        }
    }

    private break(path: string) {
        if (path.startsWith('/')) {
            path = path.slice('/'.length);
        }

        const components = path.split(/[\\/]/g);
        if (components[components.length - 1] === '') {
            components.pop();
        }

        return components;
    }

    private async cache(path: string): Promise<Email | undefined> {
        const extension = extname(path).substr(1).toLowerCase();
        let email: Email;
        try {
            switch (extension) {
                case 'eml': email = await EmailFileSystemProvider.loadEml(path); break;
                default: return;
            }
        } catch (error) {
            return;
        }

        return email;
    }
}
