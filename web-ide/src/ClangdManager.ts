import { MonacoLanguageClient } from "monaco-languageclient";
import { getLSP } from "./LSP";
import { useAppStore } from "./Store";
import * as vscode from "@codingame/monaco-vscode-api";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import * as monaco from "monaco-editor";
import { cppUri } from "./config";

enum ClangdState {
    Stopped = "stopped",
    Starting = "starting",
    Running = "running",
}

let clangdState: ClangdState = ClangdState.Stopped;

let targetState: boolean = false;
let clangdCleanup: () => void | null = null;

const rectifyLifetime = () => {
    if (!targetState && clangdState === ClangdState.Running) {
        clangdCleanup?.();
        clangdCleanup = null;
    }
};

const unsubscribeClangd = useAppStore.subscribe((state) => {
    targetState = state.clangdEnabled;
    if (targetState && clangdState === ClangdState.Stopped) {
        startClangd()
            .then((v) => (clangdCleanup = v))
            .then(rectifyLifetime);
    }
    rectifyLifetime();
});

const startClangd = async () => {
    if (clangdState !== ClangdState.Stopped) {
        throw new Error("Clangd is already running");
    }
    clangdState = ClangdState.Starting;
    const { worker, reader, writer } = await getLSP();

    console.log("GOT LSP");

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
    await languageClient.start();
    clangdState = ClangdState.Running;

    return async () => {
        await languageClient.stop();
        clangdState = ClangdState.Stopped;
        worker.terminate();
    };
};
