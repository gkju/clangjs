import {CommandConstructor} from "./Command.ts"

const commandRegistry: Map<string, CommandConstructor> = new Map();

export function CommandHandler(commandName: string) {
    return function <T extends CommandConstructor>(target: T) {
        commandRegistry.set(commandName, target);
        return target;
    }
}

export class CommandRegistry {
    static getCommand(commandName: string): CommandConstructor | undefined {
        return commandRegistry.get(commandName);
    }
}
