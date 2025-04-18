import {
    ITerminalChildProcess,
    SimpleTerminalBackend,
    SimpleTerminalProcess
} from '@codingame/monaco-vscode-terminal-service-override'
import ansiColors from 'ansi-colors'
import {CommandIO} from "./CommandIO.ts";
import { CommandExecutor } from './CommandExecutor.ts';
import {ClearCommand} from "./Commands/ClearCommand.ts";
import * as vscode from "vscode";

// TODO: make it so commands arent shaken away despite being unused
export const usedCommands = [new ClearCommand()];

class WebTerminalProcess extends SimpleTerminalProcess {
    private column = 0;
    private ioPipe: CommandIO = new CommandIO();
    private executor: CommandExecutor = new CommandExecutor(this.ioPipe);

    constructor(private dataEmitter: vscode.EventEmitter<string>,
                private propertyEmitter: vscode.EventEmitter<{
                    type: string
                    value: string
                }>) {
        super(1, 1, '/workspace', dataEmitter.event)
    }

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

    override get onDidChangeProperty() {
        return this.propertyEmitter.event;
    }

    override shutdown(immediate: boolean): void {
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

    override input(data: string): void {
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

    override clearBuffer(): void | Promise<void> {}
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