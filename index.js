import { init, WASI } from 'https://esm.sh/@wasmer/wasi@1.1.2'
import Clang from './clang.js'
import Lld from './lld.js'

await init()

export const compileAndRun = async (mainC) => {
    const clang = await Clang({
        print: console.log,
        printErr: console.error,
    })

    //console.log(clang.FS.readdir("/include/wasm32-wasi/c++/v1"));
    //console.log(clang.FS.readdir("/lib/clang/19.1.5/lib/wasi/"));
    console.log(clang.FS.readdir('/lib'))

    clang.FS.writeFile('main.cpp', mainC)
   await clang.callMain([
        '-I/lib/clang/19/include',
        '-I/include/wasm32-wasi/c++/v1',
        '-I/include/wasm32-wasi',
        //'--sysroot=lib/libc/musl',
        //'-isystem/lib/libc/musl/include',
        //'-isystem/lib/libc/musl/arch/emscripten',
        //'-isystemlib/libc/musl/arch/emscripten/bits',
        //'-isystem/lib/libcxx/include',
        '--target=wasm32-wasi',
        // '--target=wasm32-wasip1-threads',
        '-fno-exceptions',
        //'-v',
        '-std=c++20',
        '-O1',
        '-c',
        'main.cpp'
    ])
        console.log("pass")

    const mainO = clang.FS.readFile('main.o')

    const lld = await Lld()
    lld.FS.writeFile('main.o', mainO)
    await lld.callMain([
        '-flavor',
        'wasm',
        '-L/lib/wasm32-wasi',
        '-lc',
        '-lc++',
        '-lc++abi',
        '/lib/clang/19/lib/wasi/libclang_rt.builtins-wasm32.a',
        '/lib/wasm32-wasi/crt1.o',
        'main.o',
        '-o',
        'main.wasm',
    ])
    const mainWasm = lld.FS.readFile('main.wasm')

    const wasi = new  WASI ({})
    const module = await WebAssembly . compile ( mainWasm ) 
    const instance = await WebAssembly . instantiate ( module , {         ...wasi.getImports(module)     })
      
    wasi.start(instance)
    const stdout = await wasi.getStdoutString()
    return stdout;
}