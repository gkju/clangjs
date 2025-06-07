import {CommandHandler} from "../CommandRegistry.ts";
import {Command} from "../Command.ts";
import {Environment} from "../Environment.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import Clang from "../../clangjs/clang.js";
import {compileAndRun} from "../../clangjs/index-next.ts";

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

        const program = await compileAndRun(contentstr, clang);
        console.log("Program", program);


        const stdout = program.stdout.getReader();
        const stderr = program.stderr.getReader();
        const stdin = program.stdin.getWriter();

        const decoder = new TextDecoder("utf-8");
        const encoder = new TextEncoder();

        let pendingNewline = false;

        const cleanup = this.io.onStdin(data => {
            console.log("stdin:", data, "length:", data.length);
            console.log("Writing to stdin");

            if (data.includes('\n') || data.includes('\r')) {
                pendingNewline = true;
            }

            stdin.write(encoder.encode(data));
        })

        const readStream = async (reader, isError = false) => {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    if (value) {
                        let text = decoder.decode(value);

                        if (pendingNewline && !text.startsWith('\n') && !text.startsWith('\r')) {
                            text = "\n" + text;
                            pendingNewline = false;
                        }

                        if (isError) {
                            this.writeError(text.replace(/\n/g, "\n\r"));
                        } else {
                            this.writeOutput(text.replace(/\n/g, "\n\r"));
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        };
        const [,,exitcode] = await Promise.all([
            readStream(stdout, false),
            readStream(stderr, true),
            program.wait()
        ]);
        cleanup();

        return exitcode;

    }

}