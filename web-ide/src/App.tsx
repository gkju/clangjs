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
import MonacoEditor from "./MonacoEditor.js";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import "@codingame/monaco-vscode-cpp-default-extension";
import "@codingame/monaco-vscode-theme-defaults-default-extension";
import { cppUri } from "./config.js";
import { useSpring, animated, useSpringValue } from '@react-spring/web'
import {compileAndRun} from "./clangjs/index";
import {MonacoPart} from "./MonacoPart.tsx";
import {useAppStore} from "./Store.ts";
import {TerminalBackend} from "./Terminal/Terminal.ts";
import {
    TerminalService
} from "@codingame/monaco-vscode-terminal-service-override/vscode/vs/workbench/contrib/terminal/browser/terminalService";


// monaco.editor.create(document.getElementById('editor')!, {
// 	value: "import numpy as np\nprint('Hello world!')",
// 	language: 'cpp'
// });
//import { MainThreadMessageReader, MainThreadMessageWriter } from './main-thread.js';
function App() {
    // const [springs, api] = useSpring(() => ({
    //     from: { x: 0 },
    // }))

    // const [lastWidth, setLastWidth] = useState(80);
    const { initialized } = useAppStore();



    // const width = useSpringValue(80);

    // const handleClick = () => {
    //     width.start(lastWidth * 1.1)
    //     setLastWidth(lastWidth * 1.1)
    //         // api.start({
    //         //     from: {
    //         //     x: 0,
    //         //     },
    //         //     to: {
    //         //     x: 200,
    //         //     },
    //         // })
    // }

    const [editorEnabled, setEnabled] = useState(false);
    console.log("Initialized", initialized);
    
    return <>
        {/* <animated.div onClick={handleClick}
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
        </animated.div> */}
        {/*<div style={{ height: "80vh", width: "100%" }}>*/}
        {/*    <MonacoEditor value="" language="cpp" />*/}
        {/*</div>*/}
        {/*<div>*/}
        {/*    {initialized && <div style={{ height: "80vh", width: "100%" }}>*/}
        {/*        <MonacoPart part={Parts.PANEL_PART} />*/}
        {/*    </div>}*/}
        {/*    {initialized && <div style={{ height: "80vh", width: "100%" }}>*/}
        {/*        <MonacoPart part={Parts.SIDEBAR_PART} />*/}
        {/*    </div>}*/}
        {/*    {initialized && <div style={{ height: "80vh", width: "100%" }}>*/}
        {/*        <MonacoPart part={Parts.ACTIVITYBAR_PART} />*/}
        {/*    </div>}*/}
        {/*    {initialized && <div style={{ height: "80vh", width: "100%" }}>*/}
        {/*        <MonacoPart part={Parts.BANNER_PART} />*/}
        {/*    </div>}*/}
        {/*    {initialized && <div style={{ height: "80vh", width: "100%" }}>*/}
        {/*        <MonacoPart part={Parts.STATUSBAR_PART} />*/}
        {/*    </div>}*/}
        {/*    /!*{initialized && <div style={{ height: "80vh", width: "100%" }}>*!/*/}
        {/*    /!*    <MonacoPart part={Parts.TITLEBAR_PART} />*!/*/}
        {/*    /!*</div>}*!/*/}
        {/*</div>*/}
        {/* <button onClick={() => setEnabled(!editorEnabled)}>Toggle Editor</button>
        {editorEnabled && (<div style={{ height: "100vh", width: "100%" }}><MonacoEditor refCallback={console.log} value="" language="cpp" /></div>)} */}
    </>;
}

export default App;
