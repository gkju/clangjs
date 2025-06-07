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

export class PureZenFsFileSystemProvider extends Disposable implements IFileSystemProviderWithFileReadWriteCapability {
    readonly capabilities: FileSystemProviderCapabilities;
    readonly onDidChangeCapabilities: Event<void>;
    readonly onDidChangeFile: Event<readonly IFileChange[]>;
    private readonly _onDidChangeFile: Emitter<IFileChange[]>;
    private readonly _bufferedChanges: IFileChange[] = [];
    private _fireSoonHandle: number | undefined;

    constructor() {
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
        fs.writeFileSync(resource.path, content, {flag: 'w+'});
        const decoder = new TextDecoder();
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