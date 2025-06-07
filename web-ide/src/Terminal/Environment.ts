import path from 'path';
import {PureZenFsFileSystemProvider} from "../PureZenFsAdapter.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";

export class FsEntry {
    public readonly path: string;

    constructor(
        public readonly name: string,
        public readonly type: FileType,
        public readonly parent: string,
    ) {
        this.path = path.join(parent, name);
    }
}

export class Environment {

    constructor(private cwdGetter: () => string,
                private cwdSetter: (cwd: string) => void,
                private fs: PureZenFsFileSystemProvider) {
    }

    public getCwd() {
        return this.cwdGetter();
    }

    public setCwd(cwd: string) {
        this.cwdSetter(cwd);
    }

    public async enumerateDirectory(directory: string): Promise<FsEntry[]> {
        const diruri = monaco.Uri.file(directory);
        const entries: FsEntry[] = [];
        for (const [uriStr, type] of (await this.fs.readdir(diruri))) {
            console.log("uristr", uriStr, "type", type);
            const uri = monaco.Uri.parse(uriStr);
            if (type === FileType.Directory) {
                const subentries = await this.enumerateDirectory(uri.path);
                entries.push(...subentries);
            }
            entries.push(new FsEntry(path.parse(uri.path).base, type, directory));
        }

        return entries;
    }

    public async readFileAsStr(file: string): Promise<string> {
        const contents = await this.fs.readFile(monaco.Uri.file(file));

        return new TextDecoder().decode(contents);
    }

    public async wasmMkdir(directory: string, module: any): Promise<void> {
        const fs = module.FS;

        let exists = true;
        try {
            fs.stat(directory);
        } catch (e) {
            exists = false;
        }

        if (exists) {
            return;
        }

        const parentDir = path.dirname(directory);

        try {
            fs.stat(parentDir);
        } catch (e) {
            await this.wasmMkdir(parentDir, module);
        }

        fs.mkdir(directory);
    }

    public async copyFilesToEmsc(directory: string, module: any): Promise<void> {
        const entries = await this.enumerateDirectory(directory);
        const fs = module.FS;

        for (const entry of entries) {
            console.log(`${entry.name} copyFilesToEmsc(${entry.type}) with parent ${entry.parent}`);
            try {
                await this.wasmMkdir(entry.parent, module);
            } catch (e) {
                console.error(`Failed to create directory ${entry.parent}:`, e);
                continue; // Skip this entry if we can't create the directory
            }
            if (entry.type === FileType.Directory) {
                // Create directory in EMSC
                fs.mkdir(path.join(entry.parent, entry.name));
            } else if (entry.type == FileType.File) {
                // TODO: add proper support for binary non-utf8 files and stream copying for large files
                fs.writeFile(path.join(entry.parent, entry.name), await this.readFileAsStr(entry.path));
            }
        }
    }

    public resolvePath(relativePath: string): string {
        return path.resolve(this.getCwd(), relativePath);
    }

    public getFS() {
        return this.fs;
    }
};