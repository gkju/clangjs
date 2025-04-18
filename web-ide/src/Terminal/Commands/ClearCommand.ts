import {Command} from "../Command.ts";
import {CommandHandler} from "../CommandRegistry.ts";

@CommandHandler('clear')
export class ClearCommand extends Command {
    async execute(_argv: string[]): Promise<number> {
        this.writeOutput('\u001Bc');
        return 0;
    }

}