import React, { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile,
    registerFileSystemOverlay,
} from "@codingame/monaco-vscode-files-service-override";
import { cppUri } from "./config";
import {
    IReference,
    ITextFileEditorModel,
} from "@codingame/monaco-vscode-api/monaco";

interface MonacoEditorProps {
    value: string;
    language: string;
    onChange?: (value: string) => void;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
    value,
    language,
    onChange,
}) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
        null
    );
    const [isModelReady, setModelReady] = useState(false);
    const modelRef = useRef<IReference<ITextFileEditorModel> | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fileUri = monaco.Uri.file(cppUri);

        const fileSystemProvider = new RegisteredFileSystemProvider(false);
        fileSystemProvider.registerFile(
            new RegisteredMemoryFile(
                fileUri,
                '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}'
            )
        );
        const overlayDisposable = registerFileSystemOverlay(
            1,
            fileSystemProvider
        );

        console.log("CREATING MODEL");
        monaco.editor
            .createModelReference(fileUri)
            .then((model) => {
                if (isMounted) {
                    modelRef.current = model;
                    setModelReady(true);
                    console.log("MODEL READY");
                }
            })
            .catch((error) => {
                console.log("Error creating model reference:", error);
                console.log(isMounted);
                if (isMounted) {
                    setModelReady(false);
                }
            });

        return () => {
            console.log("DISPOSING MODEL");
            isMounted = false;
            overlayDisposable.dispose();
            modelRef.current?.dispose();
        };
    });

    useEffect(() => {
        if (isModelReady && editorRef.current) {
            // Create the Monaco Editor instance
            monacoEditorRef.current = monaco.editor.create(editorRef.current, {
                value,
                language,
                automaticLayout: true,
                model: modelRef?.current?.object?.textEditorModel,
                //theme: "vs-dark",
                // theme dark-modern;
                theme: "vs-dark",
            });

            // Configure workspace
            // const workspaceUri = monaco.Uri.file("/workspace/test.cpp");
            // monaco.editor.createModel(value, language, workspaceUri);

            // Handle content changes
            if (onChange) {
                monacoEditorRef.current.onDidChangeModelContent(() => {
                    const editorValue =
                        monacoEditorRef.current?.getValue() || "";
                    onChange(editorValue);
                });
            }
        }

        return () => {
            // Dispose of the Monaco Editor instance on unmount
            monacoEditorRef.current?.dispose();
        };
    }, [value, language, onChange, isModelReady]);

    return <div ref={editorRef} style={{ height: "100%", width: "100%" }} />;
};

export default MonacoEditor;
