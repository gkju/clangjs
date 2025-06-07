import {Command} from "../Command.ts";
import {CommandHandler} from "../CommandRegistry.ts";
import {Environment} from "../Environment.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";

@CommandHandler('ls')
export class LSCommand extends Command {
    async execute(argv: string[], env: Environment): Promise<number> {
        const fs = env.getFS();
        let path = '.';
        if (argv.length > 0) {
            path = argv[0];
        }

        const pathToSearch = monaco.Uri.file(env.resolvePath(path));

        try {
            const files = await fs.readdir(pathToSearch);

            for (const [name, type] of files) {

                if (type == FileType.Directory) {
                    this.writeOutput(`\x1b[34m${name}\x1b[0m  `);
                } else {
                    this.writeOutput(`${name}  `);
                }
            }
        } catch (error) {
            this.writeError(`ls: ${path}: No such file or directory\n`);
            this.writeError(error.toString() + '\n');
            return 1;
        }
        return 0;
    }

}