import {Command} from "../Command.ts";
import {CommandHandler} from "../CommandRegistry.ts";
import {Environment} from "../Environment.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";

@CommandHandler('cd')
export class CDCommand extends Command {
    async execute(argv: string[], env: Environment): Promise<number> {
        const fs = env.getFS();
        let path = '.';
        if (argv.length > 0) {
            path = argv[0];
        }

        const pathToSearch = monaco.Uri.file(env.resolvePath(path));
        try {
            const stat = await fs.stat(pathToSearch);

            if (stat.type !== FileType.Directory) {
                this.writeError(`cd: ${path}: Not a directory\n`);
                return 1;
            }
        } catch (error) {
            this.writeError(`cd: ${path}: No such file or directory\n`);
            this.writeError(error.toString() + '\n');
            return 1;
        }

        env.setCwd(env.resolvePath(path));

        return 0;
    }

}