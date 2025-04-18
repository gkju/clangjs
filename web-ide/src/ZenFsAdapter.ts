import {Disposable, DisposableStore, toDisposable} from "@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle";
import {Emitter, Event} from "@codingame/monaco-vscode-api/vscode/vs/base/common/event";
import {
    createFileSystemProviderError,
    FileSystemProviderCapabilities,
    IFileChange,
    IFileDeleteOptions,
    IFileOverwriteOptions,
    IFileSystemProviderWithFileReadWriteCapability,
    IFileWriteOptions,
    IStat,
    IWatchOptions,
    FileChangeType,
    FileType, IFileReadStreamOptions, IFileOpenOptions, FileSystemProviderErrorCode
} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import {VSBuffer} from "@codingame/monaco-vscode-api/vscode/vs/base/common/buffer";
import {basename, dirname, extUri} from "@codingame/monaco-vscode-api/vscode/vs/base/common/resources";
import {newWriteableStream, ReadableStreamEvents} from "@codingame/monaco-vscode-api/vscode/vs/base/common/stream";
import {URI} from "@codingame/monaco-vscode-api/vscode/vs/base/common/uri";
import {fs} from "@zenfs/core";
import {IDisposable} from "monaco-editor";
import {CancellationToken} from "@codingame/monaco-vscode-api/vscode/vs/base/common/cancellation";

export class ZenFsFileSystemProvider extends Disposable implements IFileSystemProviderWithFileReadWriteCapability {
    readonly capabilities: FileSystemProviderCapabilities;
    readonly onDidChangeCapabilities: Event<void>;
    readonly onDidChangeFile: Event<readonly IFileChange[]>;
    private readonly _onDidChangeFile: Emitter<IFileChange[]>;
    private readonly _bufferedChanges: IFileChange[] = [];
    private _fireSoonHandle: number | undefined;

    // TODO: currently zenfs crashes when it tries to create a file since emstat throws on nonexistent files
    // i should find a workaround for this
    constructor(private clangfs: any, private clangmnt: string) {
        super();
        this.onDidChangeCapabilities = Event.None;
        this._onDidChangeFile = new Emitter();
        this.onDidChangeFile = this._onDidChangeFile.event;

        this.capabilities =
            FileSystemProviderCapabilities.FileReadWrite |
            FileSystemProviderCapabilities.PathCaseSensitive |
            FileSystemProviderCapabilities.FileReadStream;
    }

    _fireSoon(...changes: IFileChange[]): void {
        this._bufferedChanges.push(...changes);
        if (this._fireSoonHandle != null) {
            clearTimeout(this._fireSoonHandle);
            this._fireSoonHandle = undefined;
        }
        this._fireSoonHandle = window.setTimeout(() => {
            this._onDidChangeFile.fire(this._bufferedChanges);
            this._bufferedChanges.length = 0;
        }, 5);
    }

    readFileStream(resource: URI, opts: IFileReadStreamOptions, token: CancellationToken): ReadableStreamEvents<Uint8Array> {
        const stream = newWriteableStream<Uint8Array>((data) => VSBuffer.concat(data.map((data) => VSBuffer.wrap(data))).buffer, {
            highWaterMark: 10
        });
        void (async () => {
            try {
                const fd = await this.open(resource, {
                    create: false
                });

                if (fd === undefined) {
                    throw createFileSystemProviderError('No file with that descriptor open', FileSystemProviderErrorCode.Unavailable);
                }

                const bufSize = 1024;
                const buffer = new Uint8Array(bufSize);
                const lenLeft = opts.length ? opts.length : Infinity;
                let currentPos = opts.position ? opts.position : 0;

                while (lenLeft) {
                    const bytesRead = await this.read(fd, currentPos, buffer, 0, Math.min(lenLeft, bufSize));
                    if (bytesRead === 0) {
                        break;
                    }
                    stream.write(buffer.slice(0, bytesRead));
                    currentPos += bytesRead;
                }

                stream.end();
                await this.close(fd);
            } catch (error) {
                stream.error(createFileSystemProviderError(error, FileSystemProviderErrorCode.Unknown));
                stream.end();
            }
        })();
        return stream;
    }
    open(resource: URI, opts: IFileOpenOptions): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            fs.open(resource.path, opts.create === true ? 'w+' : 'r+', (err, fd) => {
                console.log("Opened file ", resource.path);
                console.log("Got ", err, fd)
                if (err) {
                    reject(err);
                } else {
                    resolve(fd);
                }
            })
        });
    }
    close(fd: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.close(fd, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        })
    }
    read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            fs.read(fd, data, offset, length, pos, (err, bytesRead) => {
                console.log("Called read with ", fd, offset, length, pos)
                console.log("Finished read with ", err, bytesRead)
                if (err) {
                    reject(err);
                } else {
                    resolve(bytesRead);
                }
            })
        });
    }
    write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            fs.write(fd, data, offset, length, pos, (err, bytesWritten) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(bytesWritten);
                }
            })
        });
    }

    delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.rm(resource.path, (err) => {
                if (err) return reject(err);
                resolve();
                this._fireSoon({resource: resource, type: FileChangeType.DELETED});
            })
        });
    }

    mkdir(resource: URI): Promise<void> {
        console.log("mkdir called")
        if (resource.path.startsWith(this.clangmnt)) {
            this.clangfs.mkdir(resource.path.replace(this.clangmnt, ""));
            this._fireSoon({resource: resource, type: FileChangeType.ADDED});
            return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
            fs.mkdir(resource.path, 700, (err) => {
                if (err) return reject(err);
                this._fireSoon({resource: resource, type: FileChangeType.ADDED});
                resolve();
            })
        })
    }

    readFile(resource: URI): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            console.log("reading file", resource.path)
            fs.readFile(resource.path, {flag: "r"}, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            })
        });
    }

    convertZenToFileType(entry: fs.Dirent | fs.Stats): FileType {
        return entry.isFile() ? FileType.File :
            entry.isDirectory() ? FileType.Directory :
            entry.isSymbolicLink() ? FileType.SymbolicLink :
            FileType.Unknown;
    }

    readdir(resource: URI): Promise<[string, FileType][]> {
        return new Promise<[string, FileType][]>((resolve, reject) => {
            fs.readdir(resource.path, {withFileTypes: true}, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.map(entry => [entry.name, this.convertZenToFileType(entry)]));
                }
            })
        })
    }

    rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (from.toString() === to.toString()) {
                resolve();
                return;
            }

            fs.rename(from.path, to.path, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this._fireSoon({resource: from, type: FileChangeType.DELETED});
                    resolve();
                }
            })
        })
    }

    stat(resource: URI): Promise<IStat> {
        console.log("stat called on", resource.path)
        return new Promise<IStat>((resolve, reject) => {
            fs.stat(resource.path, (err, stats) => {
                if (err) {
                    reject(createFileSystemProviderError("Stat failed", FileSystemProviderErrorCode.FileNotFound));
                } else {
                    resolve({
                        type: this.convertZenToFileType(stats),
                        ctime: stats.ctimeMs,
                        mtime: stats.mtimeMs,
                        size: stats.size
                    });
                }
            })
        })
    }

    watch(resource: URI, opts: IWatchOptions): IDisposable {
        return Disposable.None;
    }

    async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions) {
        console.log("Writing file", resource.path, content)
        // fs.writeFileSync(resource.path, content, {flag: 'w+'});
        const decoder = new TextDecoder();
        if (resource.path.startsWith(this.clangmnt)) {
            this.clangfs.writeFile(resource.path.replace(this.clangmnt, ""), decoder.decode(content));
        }
        console.log("Finished writing file", resource.path);
        // const fd = await this.open(resource, {
        //     create: opts.create,
        //     unlock: opts.unlock,
        // });
        //
        // if (fd === undefined) {
        //     throw createFileSystemProviderError('No file with that descriptor open', FileSystemProviderErrorCode.Unavailable);
        // }
        //
        // let pos = 0;
        // while (pos < content.length) {
        //     const bytesWritten = await this.write(fd, pos, content, pos, content.length - pos);
        //     pos += bytesWritten;
        // }
        // await this.close(fd);
        this._fireSoon({resource: resource, type: FileChangeType.UPDATED});
        return;
    }

}

// class registeredZenFsFileSystemProvider extends Disposable implements IFileSystemProviderWithFileReadWriteCapability {
//     constructor(readonly) {
//         super();
//         this.memoryFdCounter = 0;
//         this.fdMemory = new Map();
//         this.onDidChangeCapabilities = Event.None;
//         this._onDidChangeFile = new Emitter();
//         this.onDidChangeFile = this._onDidChangeFile.event;
//         this._bufferedChanges = [];
//         this.rootByAuthority = new Map();
//         this.capabilities =
//             FileSystemProviderCapabilities.FileReadWrite |
//             FileSystemProviderCapabilities.PathCaseSensitive |
//             FileSystemProviderCapabilities.FileReadStream;
//         if (readonly) {
//             this.capabilities |= FileSystemProviderCapabilities.Readonly;
//         }
//     }
//     async open(resource) {
//         const data = await this.readFile(resource);
//         const fd = this.memoryFdCounter++;
//         this.fdMemory.set(fd, data);
//         return fd;
//     }
//     async close(fd) {
//         this.fdMemory.delete(fd);
//     }
//     async read(fd, pos, data, offset, length) {
//         const memory = this.fdMemory.get(fd);
//         if (memory == null) {
//             throw createFileSystemProviderError('No file with that descriptor open', FileSystemProviderErrorCode.Unavailable);
//         }
//         const toWrite = VSBuffer.wrap(memory).slice(pos, pos + length);
//         data.set(toWrite.buffer, offset);
//         return toWrite.byteLength;
//     }
//     write(fd, pos, data, offset, length) {
//         const memory = this.fdMemory.get(fd);
//         if (memory == null) {
//             throw createFileSystemProviderError('No file with that descriptor open', FileSystemProviderErrorCode.Unavailable);
//         }
//         const toWrite = VSBuffer.wrap(data).slice(offset, offset + length);
//         memory.set(toWrite.buffer, pos);
//         return Promise.resolve(toWrite.byteLength);
//     }
//     _lookupRoot(authority) {
//         const _authority = authority.toLowerCase();
//         let root = this.rootByAuthority.get(_authority);
//         if (root == null) {
//             root = new RegisteredDirectory();
//             this.rootByAuthority.set(_authority, root);
//         }
//         return root;
//     }
//     _lookup(uri, silent) {
//         const parts = uri.path.split('/');
//         const root = this._lookupRoot(uri.authority);
//         let entry = root;
//         for (const part of parts) {
//             if (part.length === 0) {
//                 continue;
//             }
//             let child;
//             if (entry instanceof RegisteredDirectory) {
//                 child = entry.getChildren(part);
//             }
//             if (child == null) {
//                 if (!silent) {
//                     throw createFileSystemProviderError('file not found', FileSystemProviderErrorCode.FileNotFound);
//                 }
//                 else {
//                     return undefined;
//                 }
//             }
//             entry = child;
//         }
//         return entry;
//     }
//     _lookupAsDirectory(uri, silent) {
//         const entry = this._lookup(uri, silent);
//         if (entry instanceof RegisteredDirectory) {
//             return entry;
//         }
//         throw createFileSystemProviderError('file not a directory', FileSystemProviderErrorCode.FileNotADirectory);
//     }
//     _lookupAsFile(uri, silent) {
//         const entry = this._lookup(uri, silent);
//         if (entry != null && entry.type === FileType.File) {
//             return entry;
//         }
//         throw createFileSystemProviderError('file is a directory', FileSystemProviderErrorCode.FileIsADirectory);
//     }
//     registerFile(file) {
//         const parts = file.uri.path.split('/');
//         let directory = this._lookupRoot(file.uri.authority);
//         let uri = file.uri.with({ path: '/' });
//         for (const part of parts.slice(0, -1)) {
//             if (part === '') {
//                 continue;
//             }
//             uri = extUri.joinPath(uri, part);
//             let children = directory.getChildren(part);
//             if (children == null) {
//                 const newDirectory = this.mkdirSync(uri);
//                 children = newDirectory;
//             }
//             if (!(children instanceof RegisteredDirectory)) {
//                 throw new Error(`file '${uri.toString()}' is not a directory`);
//             }
//             directory = children;
//         }
//         const name = parts[parts.length - 1];
//         if (directory.getChildren(name) != null) {
//             throw new Error(`file '${extUri.joinPath(uri, name).toString()}/' already exists`);
//         }
//         const disposableStore = new DisposableStore();
//         disposableStore.add(toDisposable(() => {
//             this._fireSoon({
//                 resource: file.uri,
//                 type: FileChangeType.DELETED
//             });
//         }));
//         disposableStore.add(file.onDidDelete(() => {
//             disposableStore.dispose();
//         }));
//         disposableStore.add(file.onDidChange(() => {
//             this._fireSoon({
//                 resource: file.uri,
//                 type: FileChangeType.UPDATED
//             });
//         }));
//         disposableStore.add(directory.addChild(name, file));
//         this._fireSoon({
//             resource: file.uri,
//             type: FileChangeType.ADDED
//         });
//         return disposableStore;
//     }
//     async stat(resource) {
//         const node = this._lookup(resource, false);
//         return await node.stats();
//     }
//     readdirSync(resource) {
//         const directory = this._lookupAsDirectory(resource, false);
//         return directory.read();
//     }
//     async readdir(resource) {
//         return this.readdirSync(resource);
//     }
//     async readFile(resource) {
//         const file = this._lookupAsFile(resource, false);
//         return await file.read();
//     }
//     readFileStream(resource, opts, token) {
//         const file = this._lookupAsFile(resource, false);
//         const stream = newWriteableStream((data) => VSBuffer.concat(data.map((data) => VSBuffer.wrap(data))).buffer, {
//             highWaterMark: 10
//         });
//         void (async () => {
//             try {
//                 if (file.readStream == null ||
//                     typeof opts.length === 'number' ||
//                     typeof opts.position === 'number') {
//                     let buffer = await file.read();
//                     if (typeof opts.position === 'number' || typeof opts.length === 'number') {
//                         buffer = buffer.slice(opts.position ?? 0, opts.length);
//                     }
//                     stream.end(buffer);
//                 }
//                 else {
//                     const reader = (await file.readStream()).getReader();
//                     let res = await reader.read();
//                     while (!res.done) {
//                         if (token.isCancellationRequested) {
//                             break;
//                         }
//                         await stream.write(res.value);
//                         if (token.isCancellationRequested) {
//                             break;
//                         }
//                         res = await reader.read();
//                     }
//                     stream.end(undefined);
//                 }
//             }
//             catch (error) {
//                 stream.error(createFileSystemProviderError(error, FileSystemProviderErrorCode.Unknown));
//                 stream.end();
//             }
//         })();
//         return stream;
//     }
//     watch() {
//         return Disposable.None;
//     }
//     async writeFile(resource, content, opts) {
//         const node = this._lookup(resource, true);
//         if (node != null && !(node instanceof RegisteredFile)) {
//             throw createFileSystemProviderError('file is directory', FileSystemProviderErrorCode.FileIsADirectory);
//         }
//         if (node == null) {
//             throw createFileSystemProviderError('file not found', FileSystemProviderErrorCode.FileNotFound);
//         }
//         if (!opts.overwrite) {
//             throw createFileSystemProviderError('file exists already', FileSystemProviderErrorCode.FileExists);
//         }
//         await node.write(content);
//     }
//     async rename() {
//         throw createFileSystemProviderError('Not allowed', FileSystemProviderErrorCode.NoPermissions);
//     }
//     mkdirSync(resource) {
//         if (this._lookup(resource, true) != null) {
//             throw createFileSystemProviderError('file exists already', FileSystemProviderErrorCode.FileExists);
//         }
//         const basename$1 = basename(resource);
//         const dirname$1 = dirname(resource);
//         const parent = this._lookupAsDirectory(dirname$1, false);
//         const directory = new RegisteredDirectory();
//         const disposable = new DisposableStore();
//         disposable.add(directory.onDidDelete(() => {
//             disposable.dispose();
//             this._fireSoon({
//                 resource,
//                 type: FileChangeType.DELETED
//             });
//         }));
//         disposable.add(directory.onDidChange(() => {
//             this._fireSoon({
//                 resource,
//                 type: FileChangeType.UPDATED
//             });
//         }));
//         parent.addChild(basename$1, directory);
//         this._fireSoon({ type: FileChangeType.ADDED, resource });
//         return directory;
//     }
//     async mkdir() {
//         throw createFileSystemProviderError("Can' create a directory", FileSystemProviderErrorCode.NoPermissions);
//     }
//     deleteSync(resource) {
//         const node = this._lookup(resource, true);
//         if (node == null) {
//             throw createFileSystemProviderError('Not found', FileSystemProviderErrorCode.FileNotFound);
//         }
//         else if (node.type === FileType.Directory) {
//             throw createFileSystemProviderError("Can't delete a directory", FileSystemProviderErrorCode.NoPermissions);
//         }
//         node.delete();
//     }
//     async delete(resource) {
//         this.deleteSync(resource);
//     }
//     _fireSoon(...changes) {
//         this._bufferedChanges.push(...changes);
//         if (this._fireSoonHandle != null) {
//             clearTimeout(this._fireSoonHandle);
//             this._fireSoonHandle = undefined;
//         }
//         this._fireSoonHandle = window.setTimeout(() => {
//             this._onDidChangeFile.fire(this._bufferedChanges);
//             this._bufferedChanges.length = 0;
//         }, 5);
//     }
// }