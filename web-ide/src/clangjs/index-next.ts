//import { init, WASI } from "https://esm.sh/@wasmer/wasi@1.1.2";
import Lld from "./lld.js";
import {init, runWasix} from "@wasmer/sdk";
import { Buffer } from "buffer";

export const compileAndRun = async (mainC, clang) => {
    // TODO: move init to a better place
    window.Buffer = Buffer;
    await init();

    //console.log(clang.FS.readdir("/include/wasm32-wasi/c++/v1"));
    //console.log(clang.FS.readdir("/lib/clang/19.1.5/lib/wasi/"));
    console.log(clang.FS.readdir("/lib"));

    clang.FS.writeFile("main.cpp", mainC);
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
        "-c",
        "main.cpp",
    ]);
    console.log("pass");

    const mainO = clang.FS.readFile("main.o");

    const lld = await Lld();
//    lld.FS.mount(lld.PROXYFS, {
//        root: "/",
//        fs: clang.FS
//    }, "/clang")
    lld.FS.writeFile("main.o", mainO);
    await lld.callMain([
        "-flavor",
        "wasm",
        "-L/lib/wasm32-wasi",
        "-lc",
        "-lc++",
        "-lc++abi",
        "/lib/clang/19/lib/wasi/libclang_rt.builtins-wasm32.a",
        "/lib/wasm32-wasi/crt1.o",
        "main.o",
        "-o",
        "main.wasm",
    ]);
    console.log("past lld")
    const mainWasm = lld.FS.readFile("main.wasm");

    if (mainWasm.length < 4 ||
        mainWasm[0] !== 0 ||
        mainWasm[1] !== 97 || // 'a'
        mainWasm[2] !== 115 || // 's'
        mainWasm[3] !== 109) { // 'm'
        console.error("Invalid WebAssembly binary:",
            Array.from(mainWasm.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        throw new Error("Generated file is not a valid WebAssembly binary");
    }

    // TODO: use wasmer wasmfs with overrides for clangfs mounts which will allow wasi
    // to read from the emscripten fs
    const module = await WebAssembly.compile(mainWasm);
    const program = await runWasix(module, {});

    // console.log("module is ", module)
    // const instance = await WebAssembly.instantiate(module, {
    //     ...wasi.getImports(module),
    // });
    //
    // wasi.start(instance);
    // console.log("wasi is ", wasi)
    // console.log("instance is", instance)
    // const stdout = await wasi.getStdoutString();

    return program;
};
