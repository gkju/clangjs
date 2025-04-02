import { useEffect, useRef, useState } from "react";
import { MonacoLanguageClient } from "monaco-languageclient";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageclient/browser';
// const reader = new BrowserMessageReader(worker);
// const writer = new BrowserMessageWriter(worker);
import "./App.css";
import "./clangjs/index.js";

import { initialize } from "@codingame/monaco-vscode-api";
import * as vscode from "@codingame/monaco-vscode-api";
import "vscode/localExtensionHost";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getFilesServiceOverride from "@codingame/monaco-vscode-files-service-override";
import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import { getLSP } from "./LSP.js";
import MonacoEditor from "./MonacoEditor.js";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import "@codingame/monaco-vscode-cpp-default-extension";
import "@codingame/monaco-vscode-theme-defaults-default-extension";
import { cppUri } from "./config.js";
import { useSpring, animated, useSpringValue } from '@react-spring/web'

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === "json") {
            return new jsonWorker();
        }
        if (label === "css" || label === "scss" || label === "less") {
            return new cssWorker();
        }
        if (label === "html" || label === "handlebars" || label === "razor") {
            return new htmlWorker();
        }
        if (label === "typescript" || label === "javascript") {
            return new tsWorker();
        }
        return new editorWorker();
    },
};
(async () => {
    await initialize({
        ...getTextMateServiceOverride(),
        ...getThemeServiceOverride(),
        ...getLanguagesServiceOverride(),
        ...getFilesServiceOverride(),
        ...getModelServiceOverride(),
    });
    // TODO: notify upon successful initialization with something like zustand
    
    const { worker, reader, writer } = await getLSP();
    
    const languageClient = new MonacoLanguageClient({
        name: "Clangd Client",
        clientOptions: {
            documentSelector: ["cpp"],
            errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => ({ action: CloseAction.DoNotRestart }),
            },
            workspaceFolder: {
                index: 0,
                name: "workspace",
                uri: monaco.Uri.file(cppUri),
            },
        },
        connectionProvider: {
            get: async (_encoding: string) => ({ reader, writer }),
        },
        //   connectionProvider: {
        //     get: async () => ({ reader, writer }),
        //   },
        connection: {
            messageTransports: { reader, writer },
        },
        messageTransports: { reader, writer },
    });
    
    console.log("STARTING LANGUAGECLIENT");
    languageClient.start();
})();


// monaco.editor.create(document.getElementById('editor')!, {
// 	value: "import numpy as np\nprint('Hello world!')",
// 	language: 'cpp'
// });
//import { MainThreadMessageReader, MainThreadMessageWriter } from './main-thread.js';
function App() {
    const [springs, api] = useSpring(() => ({
        from: { x: 0 },
    }))

    const [lastWidth, setLastWidth] = useState(80);
    
    

    const width = useSpringValue(80);

    const handleClick = () => {
        width.start(lastWidth * 1.1)
        setLastWidth(lastWidth * 1.1)
            // api.start({
            //     from: {
            //     x: 0,
            //     },
            //     to: {
            //     x: 200,
            //     },
            // })
    }
    
    return <>
        <animated.div onClick={handleClick}
            style={{
                width,
                height: 80,
                background: '#ff6d6d',
                borderRadius: 8,
                ...springs,
            }}>
            <>
            <MonacoEditor value="" language="cpp" />
            </>
        </animated.div>
        <div style={{ height: "100vh", width: "100%" }}>
            <MonacoEditor onChange={console.error} value="" language="cpp" />
        </div>
    </>;
}

export default App;
