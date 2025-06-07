import {
    ITerminalChildProcess,
    SimpleTerminalBackend,
} from '@codingame/monaco-vscode-terminal-service-override'
import ansiColors from 'ansi-colors'
import {CommandIO} from "./CommandIO.ts";
import { CommandExecutor } from './CommandExecutor.ts';
import {ClearCommand} from "./Commands/ClearCommand.ts";
import * as vscode from "vscode";
import { IProcessDataEvent, IProcessReadyEvent, ProcessPropertyType, IProcessPropertyMap } from '@codingame/monaco-vscode-api/vscode/vs/platform/terminal/common/terminal';
import {Emitter, Event} from "@codingame/monaco-vscode-api/vscode/vs/base/common/event";
import {unsupported} from "@codingame/monaco-vscode-api/tools";
import {Environment} from "./Environment.ts";
import {ZenFsFileSystemProvider} from "../ZenFsAdapter.ts";
import * as monaco from "monaco-editor";
import {LSCommand} from "./Commands/LsCommand.ts";
import {CDCommand} from "./Commands/CdCommand.ts";
import {ClangCommand} from "./Commands/ClangCommand.ts";
import {PureZenFsFileSystemProvider} from "../PureZenFsAdapter.ts";
import {ExecuteCppCommand} from "./Commands/ExecuteCpp.ts";

// TODO: make it so commands arent shaken away despite being unused
export const usedCommands = [new ClearCommand(), new LSCommand(), new CDCommand(), new ClangCommand(), new ExecuteCppCommand()];

class WebTerminalProcess implements ITerminalChildProcess {
    private column = 0;
    private ioPipe: CommandIO = new CommandIO();
    private executor: CommandExecutor = new CommandExecutor(this.ioPipe);
    private _onDidChangeProperty: vscode.Event<{ type: string; value: string }>;
    private pid: number;
    public id: number;
    private cwd: string;
    private env: Environment;
    private onData: vscode.Event<string>;
    private onReady: Emitter<IProcessReadyEvent>;
    public shouldPersist: boolean;
    public onProcessData: Event<string>;
    public onProcessReady: Event<IProcessReadyEvent>;
    public onProcessExit = Event.None;
    public processBinary: typeof unsupported;
    public refreshProperty: () => Promise<undefined>;

    constructor(private dataEmitter: vscode.EventEmitter<string>,
                private propertyEmitter: vscode.EventEmitter<{ type: string; value: string }>,
                private fs: PureZenFsFileSystemProvider) {

        const id = 1;
        const pid = 1;
        const cwd = '/workspace';
        const onData = dataEmitter.event;
        this._onDidChangeProperty = propertyEmitter.event;

        this.id = id;
        this.pid = pid;
        this.cwd = cwd;
        this.onData = onData;
        this.onReady = new Emitter();
        this.env = new Environment(
            () => this.cwd,
            (cwd) => {this.cwd = cwd},
            this.fs
        );

        this.fs.stat(monaco.Uri.file("/")).then(stat => console.log("Stat of /", stat));
        this.fs.readdir(monaco.Uri.file("/")).then(entries => console.log("Entries of /", entries));

        this.shouldPersist = false;
        this.onProcessData = this.onData;
        this.onProcessReady = this.onReady.event;
        this.onDidChangeProperty = Event.None;
        this.onProcessExit = Event.None;
        this.processBinary = unsupported;
        this.refreshProperty = async () => undefined;
        setTimeout(() => {
            this.onReady.fire({
                cwd,
                pid,
                windowsPty: undefined
            });
        });
    }

    acknowledgeDataEvent() { }
    async setUnicodeVersion() { }
    async getInitialCwd() {
        return this.cwd;
    }
    async getCwd() {
        return this.cwd;
    }
    async getLatency() {
        return 0;
    }
    async updateProperty() { }

    async start(): Promise<undefined> {
        ansiColors.enabled = true
        this.dataEmitter.fire(`This is a web terminal\r\n${ansiColors.green('$')} `)
        setTimeout(() => {
            this.dataEmitter.fire('\u001B]0;Web terminal title\u0007')
        }, 0)
        this.column = 2

        this.ioPipe.onStdout((data: string) => {
            console.log("Pipe received data", data);
            this.dataEmitter.fire(data)
        });
        this.ioPipe.onStderr((data: string) => {
            console.log("got err data", data)
            this.dataEmitter.fire(ansiColors.red(data))
        })

        return undefined
    }

    get onDidChangeProperty(): vscode.Event<{ type: string; value: string }> {
        return this._onDidChangeProperty;
    }

    set onDidChangeProperty(evt: vscode.Event<{ type: string; value: string }>) {
        this._onDidChangeProperty = evt;
    }

    shutdown(immediate: boolean): void {
        console.log('shutdown', immediate)
        this.ioPipe.dispose();
    }

    private linebuffer: string = '';

    handleLine(line: string): void {
        console.log('handling line', line)
        const argv = line.split(' ')
        const command = argv.shift()

        this.executor.execute(command, argv, this.env).finally(() => this.flushLine())
    }

    private escapeSequence: string = '';
    private inEscapeSequence: boolean = false;
    private commandHistory: string[] = [];
    private historyIndex: number = -1;
    private cursorPosition: number = 0;

    input(data: string): void {
        console.log('input', data)
        if (this.executor.isActive()) {
            this.ioPipe.writeInput(data)
            this.dataEmitter.fire(data)
            return;
        }
        for (const c of data) {
            if (c === '\u001b') {
                this.inEscapeSequence = true;
                this.escapeSequence = c;
                continue;
            }

            if (this.inEscapeSequence) {
                this.escapeSequence += c;

                // Check if we have a complete sequence
                if (this.escapeSequence === '\u001b[A') { // Up arrow
                    this.handleUpArrow();
                    this.inEscapeSequence = false;
                    this.escapeSequence = '';
                } else if (this.escapeSequence === '\u001b[B') { // Down arrow
                    this.handleDownArrow();
                    this.inEscapeSequence = false;
                    this.escapeSequence = '';
                } else if (this.escapeSequence === '\u001b[C') { // Right arrow
                    this.handleRightArrow();
                    this.inEscapeSequence = false;
                    this.escapeSequence = '';
                } else if (this.escapeSequence === '\u001b[D') { // Left arrow
                    this.handleLeftArrow();
                    this.inEscapeSequence = false;
                    this.escapeSequence = '';
                } else if (this.escapeSequence.length >= 3 && !this.escapeSequence.startsWith('\u001b[')) {
                    // Invalid escape sequence
                    this.inEscapeSequence = false;
                    this.escapeSequence = '';
                }
                continue;
            }

            if (c.charCodeAt(0) === 13) {
                if (this.linebuffer.trim().length > 0) {
                    this.commandHistory.push(this.linebuffer);
                    this.historyIndex = this.commandHistory.length;
                }
                this.flushLine(false);
                this.handleLine(this.linebuffer);
                this.linebuffer = '';
            } else if (c.charCodeAt(0) === 127) {
                if (this.cursorPosition > 0) {
                    // Remove the character before the cursor
                    this.linebuffer = this.linebuffer.slice(0, this.cursorPosition - 1) +
                        this.linebuffer.slice(this.cursorPosition);
                    this.cursorPosition--;
                    this.column--;

                    // Update the display
                    this.refreshLineAfterEdit();
                }
            } else if (c.charCodeAt(0) == 9) {
                this.handleTab(this.linebuffer);
            } else {
                this.linebuffer = this.linebuffer.slice(0, this.cursorPosition) +
                    c +
                    this.linebuffer.slice(this.cursorPosition);
                this.cursorPosition++;
                this.column++;

                if (this.cursorPosition < this.linebuffer.length) {
                    this.refreshLineAfterInsert(c);
                } else {
                    this.dataEmitter.fire(c);
                }
            }
        }
    }

    // Add these helper methods for arrow key handling
    private handleUpArrow(): void {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.replaceLineBuffer(this.commandHistory[this.historyIndex]);
        }
    }

    private handleDownArrow(): void {
        if (this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            this.replaceLineBuffer(this.commandHistory[this.historyIndex]);
        } else if (this.historyIndex === this.commandHistory.length - 1) {
            this.historyIndex++;
            this.replaceLineBuffer('');
        }
    }

    private handleRightArrow(): void {
        if (this.cursorPosition < this.linebuffer.length) {
            this.cursorPosition++;
            this.dataEmitter.fire('\u001b[C'); // Move cursor right
        }
    }

    private handleLeftArrow(): void {
        if (this.cursorPosition > 0) {
            this.cursorPosition--;
            this.dataEmitter.fire('\u001b[D'); // Move cursor left
        }
    }

    private refreshLineAfterEdit(): void {
        this.dataEmitter.fire('\b');

        this.dataEmitter.fire('\u001b[K');

        const textAfterCursor = this.linebuffer.slice(this.cursorPosition);
        if (textAfterCursor.length > 0) {
            this.dataEmitter.fire(textAfterCursor);

            this.dataEmitter.fire(`\u001b[${textAfterCursor.length}D`);
        }
    }

    private refreshLineAfterInsert(insertedChar: string): void {
        this.dataEmitter.fire(insertedChar);

        this.dataEmitter.fire('\u001b[K');

        const textAfterCursor = this.linebuffer.slice(this.cursorPosition);
        if (textAfterCursor.length > 0) {
            this.dataEmitter.fire(textAfterCursor);

            this.dataEmitter.fire(`\u001b[${textAfterCursor.length}D`);
        }
    }

    private handleTab(currentLine: string): void {

    }

    private replaceLineBuffer(newContent: string): void {
        // Clear current line content
        const backspaces = '\u001b[2K\r' + ansiColors.green('$') + ' ';
        this.dataEmitter.fire(backspaces);

        // Set new content
        this.linebuffer = newContent;
        this.column = 2 + newContent.length;
        this.cursorPosition = newContent.length;
        this.dataEmitter.fire(newContent);
    }

    private flushLine(prefix = true): void {
        this.dataEmitter.fire(`\r\n${prefix ? ansiColors.green('$') : ''} `)

        this.column = prefix ? 2 : 0;
        this.cursorPosition = 0;
    }

    resize(cols: number, rows: number): void {
        console.log('resize', cols, rows)
    }

    clearBuffer(): void | Promise<void> {}
}

export class TerminalBackend extends SimpleTerminalBackend {
    private fs: PureZenFsFileSystemProvider;

    constructor(fs: PureZenFsFileSystemProvider) {
        super();
        this.fs = fs;
    }
    override getDefaultSystemShell = async (): Promise<string> => 'webshell'
    override createProcess = async (): Promise<ITerminalChildProcess> => {
        const dataEmitter = new vscode.EventEmitter<string>()
        const propertyEmitter = new vscode.EventEmitter<{
            type: string
            value: string
        }>()

        return new WebTerminalProcess(dataEmitter, propertyEmitter, this.fs)
    }
}