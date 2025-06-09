import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
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
import "./clangjs/index.js";
import {
    Parts,
    onPartVisibilityChange,
    attachPart
} from '@codingame/monaco-vscode-views-service-override';

import { initialize, getService } from "@codingame/monaco-vscode-api";
import * as vscode from "@codingame/monaco-vscode-api";
import "vscode/localExtensionHost";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getFilesServiceOverride, {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile, registerFileSystemOverlay
} from "@codingame/monaco-vscode-files-service-override";
import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import getConfigServiceOverride from "@codingame/monaco-vscode-configuration-service-override";
import getViewsServiceOverride, { IReference, IResolvedTextEditorModel, OpenEditor } from "@codingame/monaco-vscode-views-service-override";
import getEditSessionsServiceOverride from '@codingame/monaco-vscode-edit-sessions-service-override'
import getEnvironmentServiceOverride from '@codingame/monaco-vscode-environment-service-override'
import getLifecycleServiceOverride from '@codingame/monaco-vscode-lifecycle-service-override'
import getStorageServiceOverride from '@codingame/monaco-vscode-storage-service-override'
import getExtensionServiceOverride from '@codingame/monaco-vscode-extensions-service-override'
import getTerminalServiceOverride, {ITerminalService} from '@codingame/monaco-vscode-terminal-service-override'
import getBannerServiceOverride from '@codingame/monaco-vscode-view-banner-service-override'
import getStatusBarServiceOverride from '@codingame/monaco-vscode-view-status-bar-service-override'
import getTitleBarServiceOverride from '@codingame/monaco-vscode-view-title-bar-service-override'
import getScmServiceOverride from '@codingame/monaco-vscode-scm-service-override'
import getWorkbenchServiceOverride from '@codingame/monaco-vscode-workbench-service-override'
import getExplorerServiceOverride from '@codingame/monaco-vscode-explorer-service-override'
import getDialogsServiceOverride from '@codingame/monaco-vscode-dialogs-service-override'
import { getLSP } from "./LSP.js";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import "@codingame/monaco-vscode-cpp-default-extension";
import "@codingame/monaco-vscode-theme-defaults-default-extension";
import {cppUri, workspaceFile, workspacePath, defaultProgram} from "./config.js";
import { useSpring, animated, useSpringValue } from '@react-spring/web'
import {compileAndRun} from "./clangjs/index";
import {MonacoPart} from "./MonacoPart.tsx";
import {useAppStore} from "./Store.ts";
import {TerminalBackend} from "./Terminal/Terminal.ts";
import {configure, InMemory, configureSingle, fs, resolveMountConfig, mount} from '@zenfs/core';
// TODO: fix clangjs to support non-archaic zenfs versions, have to recompile it with newer emscripten
import ZenEmscriptenNodeFS from "@zenfs/emscripten/plugin";
import { Emscripten } from '@zenfs/emscripten';
import Clang from "./clangjs/clang.js";
import {ZenFsFileSystemProvider} from "./ZenFsAdapter.ts";
import {PureZenFsFileSystemProvider} from "./PureZenFsAdapter.ts";

self.MonacoEnvironment = {
    getWorker(_, label) {
        console.log("GETTING WORKER", label);
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
        if (label === "TextMateWorker") {
            return new Worker(
                new URL('@codingame/monaco-vscode-textmate-service-override/worker', import.meta.url),
                { type: 'module' }
            );
        }
        return new editorWorker();
    },
};

const cppFileUri = monaco.Uri.file(cppUri);

// const fileSystemProvider = new RegisteredFileSystemProvider(false);
// fileSystemProvider.registerFile(
//     new RegisteredMemoryFile(
//         monaco.Uri.file(workspaceFile),
//         JSON.stringify(
//             {
//                 folders: [
//             {
//                 path: '/workspace'
//             }
//                 ]
//             },
//                 null,
//                 2
//         )
//     )
// )
// fileSystemProvider.registerFile(
//     new RegisteredMemoryFile(
//         cppFileUri,
//         '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}'
//     )
// );
// fileSystemProvider.registerFile(
//     new RegisteredMemoryFile(
//         monaco.Uri.file(cppUri + "dwa" + ".cpp"),
//         '#include <iostream>\n\nint main() {\n    std::cout << "TRHello, World!" << std::endl;\n    return 0;\n}'
//     )
// );
// const overlayDisposable = registerFileSystemOverlay(
//     1,
//     fileSystemProvider
// );

(async () => {
    // clang.FS.writeFile("main.cpp", '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}');
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
    const clang = await Clang({});


    // await configureSingle({backend: Emscripten, FS: clang.FS});

    //clang.FS.writeFile(cppUri + "dwa" + ".cpp", '#include <iostream>\n\nint main() {\n    std::cout << "TRHello, World!" << std::endl;\n    return 0;\n}');
    // const fd = fs.openSync(cppUri + "dwa" + ".cpp", "r+");
    await configure({mounts: {
            '/usr': {backend: Emscripten, FS: clang.FS}
        }});

    fs.mkdirSync(workspacePath, {recursive: true});
    fs.writeFileSync(workspaceFile, JSON.stringify(
        {
            folders: [
                {
                    path: '/workspace'
                }
            ]
        },
        null,
        2
    ));
    fs.writeFileSync(cppUri, defaultProgram);

    const adapter = new PureZenFsFileSystemProvider();
    registerFileSystemOverlay(1, adapter);



    console.log("Emscripten is ", Emscripten);


    await initialize({
        ...getTextMateServiceOverride(),
        ...getThemeServiceOverride(),
        ...getLanguagesServiceOverride(),
        ...getFilesServiceOverride(),
        ...getModelServiceOverride(),
        ...getConfigServiceOverride(),
        ...getEditSessionsServiceOverride(),
        ...getEnvironmentServiceOverride(),
        ...getLifecycleServiceOverride(),
        ...getStorageServiceOverride({
            fallbackOverride: {
                'workbench.activity.showAccounts': false
            }
        }),
        ...getExtensionServiceOverride(),
        ...getBannerServiceOverride(),
        ...getStatusBarServiceOverride(),
        ...getTitleBarServiceOverride(),
        ...getTerminalServiceOverride(new TerminalBackend(adapter)),
        ...getExplorerServiceOverride(),
        ...getDialogsServiceOverride(),
        ...getWorkbenchServiceOverride(),
        ///...getViewsServiceOverride((async (model, options) => {console.log("CREATING EDITOR"); console.log(model, options); return null;})),
    }, document.getElementById("monaco-editor-root"), {
        workspaceProvider: {
            trusted: true,
            async open() {
                console.log("OPENING", window.location.href)
                window.open(window.location.href)
                return true
            },
            workspace: {
                workspaceUri: monaco.Uri.file(workspaceFile)
            }
        },
    });
    // TODO: notify upon successful initialization with something like zustand
    console.log("INITIALIZED MONACO ENVIRONMENT");
    useAppStore.getState().setInitialized(true);

    const themeService = await getService(vscode.IThemeService);
    console.log(themeService.getColorTheme());
    const service = await getService(vscode.IConfigurationService);
    (service.updateValue("workbench.colorTheme", "Default Dark Modern"));

    console.log(await getService(ITerminalService));

    console.log("GETTING LSP")

    const { worker, reader, writer } = await getLSP();

    console.log("GOT LSP")

    const languageClient = new MonacoLanguageClient({
        name: "Clangd Client",
        clientOptions: {
            documentSelector: ["cpp"],
            errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => ({ action: CloseAction.DoNotRestart }),
            },
            // workspaceFolder: workspacePath
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
