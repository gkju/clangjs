import { init, WASI } from 'https://esm.sh/@wasmer/wasi@1.1.2'
import Clang from './clang.js'
import Lld from './lld.js'

//import Clangd from './clangd.js';
//console.log(Clangd)
//const textEncoder = new TextEncoder();
//let resolveStdinReady = () => {};
//const stdinChunks = [];
//const currentStdinChunk = [];
//
//const stdin = () => {
//  if (currentStdinChunk.length === 0) {
//    if (stdinChunks.length === 0) {
//      // Should not reach here
//      // stdinChunks.push("Content-Length: 0\r\n", "\r\n");
//      console.error("Try to fetch exhausted stdin");
//      return null;
//    }
//    const nextChunk = stdinChunks.shift();
//    currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
//  }
//  return currentStdinChunk.shift();
//};
//
//const LF = 10;
//
//const stdout = (charCode) => {
//    if (charCode === LF) {
//        console.log("%c%s", "color: green", stderrLine);
//        stderrLine = "";
//      } else {
//        stderrLine += String.fromCharCode(charCode);
//      }
//};
//
//let stderrLine = "";
//const stderr = (charCode) => {
//   // console.log(String.fromCharCode(charCode));
//  if (charCode === LF) {
//    console.log("%c%s", "color: darkorange", stderrLine);
//    stderrLine = "";
//  } else {
//    stderrLine += String.fromCharCode(charCode);
//  }
//};
//
//const stdinReady = async () => {
//  if (stdinChunks.length === 0) {
//    return new Promise((r) => (resolveStdinReady = r));
//  }
//};
//
//const onAbort = () => {
//  writer.end();
//  self.reportError("clangd aborted");
//};
//console.log('here')
//console.log(Clangd)
//const clangd = await Clangd({
//  thisProgram: "/usr/bin/clangd",
////   locateFile: (path, prefix) => {
////     return path.endsWith(".wasm") ? wasmDataUrl : `${prefix}${path}`;
////   },
//  stdinReady,
//  stdin,
//  stdout,
//  stderr,
//  onExit: onAbort,
//  onAbort,
//});
//console.log(Clangd);
//
//function startServer() {
//    console.log("%c%s", "font-size: 2em; color: green", "clangd started");
//    console.log(clangd.callMain([]));
//  }
//  startServer();
//console.log("started")
//  const pipeData = data => {
//    // non-ASCII characters cause bad Content-Length. Just escape them.
//    const body = JSON.stringify(data).replace(/[\u007F-\uFFFF]/g, (ch) => {
//      return "\\u" + ch.codePointAt(0).toString(16).padStart(4, "0");
//    });
//    const header = `Content-Length: ${body.length}\r\n`;
//    const delimiter = "\r\n";
//    console.log(header, delimiter, body, "piping");
//    stdinChunks.push(header, delimiter, body);
//    resolveStdinReady();
//    // console.log("%c%s", "color: red", `${header}${delimiter}${body}`);
//  }

  

await init()
//
//pipeData({
//    jsonrpc: "2.0",
//    id: 1,
//    method: "initialize",
//    params: {
//      processId: null,
//      rootUri: "file:///path/to/project",
//      capabilities: {}
//    }
//  })
//pipeData({
//    jsonrpc: "2.0",
//    method: "textDocument/didOpen",
//    params: {
//      textDocument: {
//        uri: "file:///path/to/project/test.cpp",
//        languageId: "cpp",
//        version: 1,
//        text: `#include <vector>
//  int main() {
//    std::vector<int> v;
//    v.
//  }`
//      }
//    }
//  })
//  pipeData({
//    jsonrpc: "2.0",
//    id: 2,
//    method: "textDocument/completion",
//    params: {
//      textDocument: {
//        uri: "file:///path/to/project/test.cpp"
//      },
//      position: {
//        line: 3,    // 0-based (4th line)
//        character: 4 // Position after "v."
//      }
//    }
//  })
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