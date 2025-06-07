import {CommandIO} from "./CommandIO.ts";
import {Environment} from "./Environment.ts";

export type CommandConstructor = new () => Command;

export abstract class Command {
    protected io: CommandIO | null = null;

    setIO(io: CommandIO): void {
        this.io = io;
        this.setupIO();
    }

    protected setupIO(): void {}

    abstract execute(argv: string[], env: Environment): Promise<number>;

    protected writeOutput(data: string): void {
        this.io?.writeOutput(data);
    }

    protected writeError(data: string): void {
        this.io?.writeError(data);
    }
}

