import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, language, onChange }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      // Create the Monaco Editor instance
      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        automaticLayout: true,
      });

      // Handle content changes
      if (onChange) {
        monacoEditorRef.current.onDidChangeModelContent(() => {
          const editorValue = monacoEditorRef.current?.getValue() || '';
          onChange(editorValue);
        });
      }
    }

    return () => {
      // Dispose of the Monaco Editor instance on unmount
      monacoEditorRef.current?.dispose();
    };
  }, [value, language, onChange]);

  return <div ref={editorRef} style={{ height: '100%', width: '100%' }} />;
};

export default MonacoEditor;