import {CommandHandler} from "../CommandRegistry.ts";
import {Command} from "../Command.ts";
import {Environment} from "../Environment.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import Clang from "../../clangjs/clang.js";
import {compileAndRun} from "../../clangjs/index.js";

@CommandHandler('cpp-exec')
export class ExecuteCppCommand extends Command {
    async execute(argv: string[], env: Environment): Promise<number> {
        const fs = env.getFS();
        let path = '.';
        if (argv.length > 0) {
            path = argv[0];
        }

        const resolvedPath = monaco.Uri.file(env.resolvePath(path));
        const stat = await fs.stat(resolvedPath);
        if (stat.type !== FileType.File) {
            this.writeError(`cpp-exec: ${path}: No such file\n`);
            return 1;
        }
        const contents = await fs.readFile(resolvedPath);

        const contentstr = new TextDecoder().decode(contents);
        console.log("File contents:", contentstr);

        const clang = await Clang({
            print: data => {this.writeOutput(data.replace("\n", "\n\r"))},
            printErr: data => {this.writeError(data.replace("\n", "\n\r"))},
        })

        console.log("Clang is", clang)

        const out = await compileAndRun(contentstr, clang);
        this.writeOutput(out);


        return 0;

    }

}