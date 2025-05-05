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

// TODO: make it so commands arent shaken away despite being unused
export const usedCommands = [new ClearCommand()];

class WebTerminalProcess implements ITerminalChildProcess {
    private column = 0;
    private ioPipe: CommandIO = new CommandIO();
    private executor: CommandExecutor = new CommandExecutor(this.ioPipe);
    private _onDidChangeProperty: vscode.Event<{ type: string; value: string }>;
    private pid: number;
    public id: number;
    private cwd: string;
    private onData: vscode.Event<string>;
    private onReady: Emitter<IProcessReadyEvent>;
    public shouldPersist: boolean;
    public onProcessData: Event<string>;
    public onProcessReady: Event<IProcessReadyEvent>;
    public onProcessExit = Event.None;
    public processBinary: typeof unsupported;
    public refreshProperty: () => Promise<undefined>;

    constructor(private dataEmitter: vscode.EventEmitter<string>,
                private propertyEmitter: vscode.EventEmitter<{
                    type: string
                    value: string
                }>) {

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
        this.executor.execute(command, argv).finally(() => this.flushLine())
    }

    input(data: string): void {
        console.log('input', data)
        if (this.executor.isActive()) {
            this.ioPipe.writeInput(data)
            this.dataEmitter.fire(data)
            return;
        }
        for (const c of data) {
            if (c.charCodeAt(0) === 13) {
                this.flushLine();
                this.handleLine(this.linebuffer);
                this.linebuffer = ''
                this.column = 2
            } else if (c.charCodeAt(0) === 127) {
                if (this.column > 2) {
                    this.dataEmitter.fire('\b \b')
                    this.linebuffer = this.linebuffer.slice(0, -1)
                    this.column--
                }
            } else {
                this.dataEmitter.fire(c)
                this.linebuffer += c
                this.column++
            }
        }
    }

    private flushLine() {
        this.dataEmitter.fire(`\r\n${ansiColors.green('$')} `)
    }

    resize(cols: number, rows: number): void {
        console.log('resize', cols, rows)
    }

    clearBuffer(): void | Promise<void> {}
}

export class TerminalBackend extends SimpleTerminalBackend {
    override getDefaultSystemShell = async (): Promise<string> => 'webshell'
    override createProcess = async (): Promise<ITerminalChildProcess> => {
        const dataEmitter = new vscode.EventEmitter<string>()
        const propertyEmitter = new vscode.EventEmitter<{
            type: string
            value: string
        }>()

        return new WebTerminalProcess(dataEmitter, propertyEmitter)
    }
}