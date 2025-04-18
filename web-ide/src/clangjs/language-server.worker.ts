import { JsonStream } from "./json_stream.ts";

declare var self: DedicatedWorkerGlobalScope;

import Clangd from "./clangd.js";
import { workspacePath, cppUri } from "../config.ts";

(async () => {
    // console.log("CREATING WORKER")
// console.log(Clangd);
const textEncoder = new TextEncoder();
let resolveStdinReady = () => {};
const stdinChunks = [];
const currentStdinChunk = [];

const stdin = () => {
    if (currentStdinChunk.length === 0) {
        if (stdinChunks.length === 0) {
            // Should not reach here
            // stdinChunks.push("Content-Length: 0\r\n", "\r\n");
            //console.error("Try to fetch exhausted stdin");
            return null;
        }
        const nextChunk = stdinChunks.shift();
        currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
    }
    return currentStdinChunk.shift();
};

const LF = 10;
const jsonStream = new JsonStream();
const stdout = (charCode: number) => {
    const step = jsonStream.insert(charCode);
    if (step != null) {
        self.postMessage(JSON.parse(step));
        //writer.write(JSON.parse(step));
    }
    //    if (charCode === LF) {
    //        //console.log("%c%s", "color: green", stderrLine);
    //        stderrLine = "";
    //      } else {
    //        stderrLine += String.fromCharCode(charCode);
    //      }
};

let stderrLine = "";
const stderr = (charCode) => {
    // //console.log(String.fromCharCode(charCode));
    if (charCode === LF) {
        //console.log("%c%s", "color: darkorange", stderrLine);
        stderrLine = "";
    } else {
        stderrLine += String.fromCharCode(charCode);
    }
};

const stdinReady = async () => {
    if (stdinChunks.length === 0) {
        return new Promise((r) => (resolveStdinReady = r));
    }
};

const onAbort = () => {
    writer.end();
    self.reportError("clangd aborted");
};
//console.log("here");
//console.log(Clangd);
const clangd = await Clangd({
    thisProgram: "/usr/bin/clangd",
    //   locateFile: (path, prefix) => {
    //     return path.endsWith(".wasm") ? wasmDataUrl : `${prefix}${path}`;
    //   },
    stdinReady,
    stdin,
    stdout,
    stderr,
    onExit: onAbort,
    onAbort,
});
//console.log(Clangd);

const flags = [
    "--target=wasm32-wasi",
    "-I/usr/include/c++/v1",
    "-I/usr/include/wasm32-wasi/c++/v1",
    "-I/usr/include",
    "-I/usr/include/wasm32-wasi",
    "-std=c++23",
    "-fno-exceptions",
];

try {
    //console.log("clangd", clangd);
    clangd.FS.mkdir("/usr" + workspacePath);
    clangd.FS.writeFile("/usr" + cppUri, "");
    clangd.FS.writeFile(
        "/usr" + `${workspacePath}/.clangd`,
        JSON.stringify({ CompileFlags: { Add: flags } })
    );
} catch (e) {
    console.error("Error writing to clangd FS:", e);
}

function startServer() {
    //console.log("%c%s", "font-size: 2em; color: green", "clangd started");
    const res = (clangd.callMain([]));
    //console.log(res);
}
startServer();
//console.log("started");
self.postMessage({ type: "ready" });
const pipeData = (data) => {
    //console.log("Received data:", data);
    // non-ASCII characters cause bad Content-Length. Just escape them.
    const body = JSON.stringify(data).replace(/[\u007F-\uFFFF]/g, (ch) => {
        return "\\u" + ch.codePointAt(0).toString(16).padStart(4, "0");
    });
    const header = `Content-Length: ${body.length}\r\n`;
    const delimiter = "\r\n";
    //console.log(header, delimiter, body, "piping");
    stdinChunks.push(header, delimiter, body);
    resolveStdinReady();
    // //console.log("%c%s", "color: red", `${header}${delimiter}${body}`);
};

self.onmessage = (event) => {
    //console.log("Received message from main thread:", event.data);
    pipeData(event.data);
};

// reader.listen((data) => {
//   pipeData(data);
// });

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
})();