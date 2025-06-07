import {CommandIO} from "./CommandIO.ts";

import {CommandRegistry} from "./CommandRegistry.ts";
import {Environment} from "./Environment.ts";

export class CommandExecutor {
    constructor(private io: CommandIO) {
        console.log("EXEcutor created")
    }

    private executionInProgress = false;

    isActive() {
        return this.executionInProgress;
    }

    async execute(command: string, args: string[], env: Environment): Promise<number> {
        const commandClass = CommandRegistry.getCommand(command);
        if (!commandClass) {
            this.io.writeError(`Command not found: ${command}`);
            return 1;
        }

        if (this.executionInProgress) {
            // TODO: mutex io, improve the executor
            throw new Error('Another command is already executing.');
        }

        const commandInstance = new commandClass();
        commandInstance.setIO(this.io);
        this.executionInProgress = true;

        try {
            return await commandInstance.execute(args, env);
        } catch (error) {
            this.io.writeError(`Error executing command: ${error}`);
            return 1;
        } finally {
            this.executionInProgress = false;
        }
    }
}