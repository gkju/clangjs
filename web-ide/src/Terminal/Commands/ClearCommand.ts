import {Command} from "../Command.ts";
import {CommandHandler} from "../CommandRegistry.ts";
import {Environment} from "../Environment.ts";

@CommandHandler('clear')
export class ClearCommand extends Command {
    async execute(_argv: string[], _env: Environment): Promise<number> {
        this.writeOutput('\u001Bc');
        return 0;
    }
}