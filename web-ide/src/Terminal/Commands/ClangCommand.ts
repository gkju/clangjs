import {Command} from "../Command.ts";
import {CommandHandler} from "../CommandRegistry.ts";
import {Environment} from "../Environment.ts";
import * as monaco from "monaco-editor";
import {FileType} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import Clang from "../../clangjs/clang";

@CommandHandler('g++')
export class ClangCommand extends Command {
    async execute(argv: string[], env: Environment): Promise<number> {
        const fs = env.getFS();

        const clang = await Clang({
            print: data => {this.writeOutput(data.replace("\n", "\n\r"))},
            printErr: data => {this.writeError(data.replace("\n", "\n\r"))},
        })

        
        try {

            await env.copyFilesToEmsc(env.getCwd(), clang);

            console.log(clang.FS.readdir(env.getCwd()))
            console.log(clang.FS);
            //clang.FS.trackingDelegate['onWriteToFile'] = (path, byteCnt) => {console.log("Wrote to", path, byteCnt)};
            
            
            await clang.callMain([
                "-I/lib/clang/19/include",
                "-I/include/wasm32-wasi/c++/v1",
                "-I/include/wasm32-wasi",
                //'--sysroot=lib/libc/musl',
                //'-isystem/lib/libc/musl/include',
                //'-isystem/lib/libc/musl/arch/emscripten',
                //'-isystemlib/libc/musl/arch/emscripten/bits',
                //'-isystem/lib/libcxx/include',
                "--target=wasm32-wasi",
                // '--target=wasm32-wasip1-threads',
                "-fno-exceptions",
                //'-v',
                "-std=c++23",
                "-O1",
                ...argv
            ]);

            console.log(clang.FS.readdir(env.getCwd()))
        } catch (e) {
            console.error(e);
        }

        // await clang.callMain([
        //     "-I/lib/clang/19/include",
        //     "-I/include/wasm32-wasi/c++/v1",
        //     "-I/include/wasm32-wasi",
        //     //'--sysroot=lib/libc/musl',
        //     //'-isystem/lib/libc/musl/include',
        //     //'-isystem/lib/libc/musl/arch/emscripten',
        //     //'-isystemlib/libc/musl/arch/emscripten/bits',
        //     //'-isystem/lib/libcxx/include',
        //     "--target=wasm32-wasi",
        //     // '--target=wasm32-wasip1-threads',
        //     "-fno-exceptions",
        //     //'-v',
        //     "-std=c++23",
        //     "-O1",
        //     "-c",
        //     clangsPath,
        // ]);

        // await clang.callMain([
        //     "-I/lib/clang/19/include",
        //     "-I/include/wasm32-wasi/c++/v1",
        //     "-I/include/wasm32-wasi",
        //     //'--sysroot=lib/libc/musl',
        //     //'-isystem/lib/libc/musl/include',
        //     //'-isystem/lib/libc/musl/arch/emscripten',
        //     //'-isystemlib/libc/musl/arch/emscripten/bits',
        //     //'-isystem/lib/libcxx/include',
        //     "--target=wasm32-wasi",
        //     // '--target=wasm32-wasip1-threads',
        //     "-fno-exceptions",
        //     //'-v',
        //     "-std=c++23",
        //     "-O1",
        //     "-c",
        //     "main.cpp",
        // ]);

        return 0;
    }

}
