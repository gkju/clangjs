import { useEffect, useRef, useState } from 'react';
import { MonacoLanguageClient } from 'monaco-languageclient';

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageclient/browser';
// const reader = new BrowserMessageReader(worker);
// const writer = new BrowserMessageWriter(worker);
import { WrapperConfig } from 'monaco-editor-wrapper';
import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import './App.css'
import './clangjs/index.js'
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageclient/browser.js';
import { WorkerComms } from './main-thread.js';

const worker = new Worker(new URL('./clangjs/language-server.worker.ts', import.meta.url), {
  type: 'module'
})

const comms = new WorkerComms(worker);

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

await comms.waitForReady();
//const reader = comms.getReader();
//const writer = comms.getWriter();
const reader = new BrowserMessageReader(worker);
const writer = new BrowserMessageWriter(worker);

// const languageClient = new MonacoLanguageClient({
//   name: 'Clangd Client',
//   clientOptions: { documentSelector: ['cpp', 'c']
//     },
//   connectionProvider: {
//     get: async () => ({ reader, writer }),
//   },
//   connection: {
//     messageTransports: { reader, writer },
//   },
//   messageTransports: { reader, writer },
// });

// console.log("STARTING LANGUAGECLIENT")
// languageClient.start();

// monaco.editor.create(document.getElementById('editor')!, {
// 	value: "import numpy as np\nprint('Hello world!')",
// 	language: 'cpp'
// });
//import { MainThreadMessageReader, MainThreadMessageWriter } from './main-thread.js';
function App() {
  const config: WrapperConfig = {
    $type: "extended",
    languageClientConfigs: {
      configs: {
      cpp: {
        name: 'Clangd Client',
        clientOptions: { documentSelector: ['cpp'],
          },
        connection: {
          messageTransports: { reader, writer },
          options: {
              $type: 'WorkerDirect',
              worker: worker
          }
        },
      },
    }},
    editorAppConfig: {
      codeResources: {
        modified: {
                uri: ('/workspace/test.cpp'),
                text: 'print("Hello, World!")'
        }
      }
    }
  };

  return (
      <MonacoEditorReactComp wrapperConfig={config} />
  )
}

export default App
