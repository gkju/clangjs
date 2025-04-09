import getViewsServiceOverride, {
    Parts,
    onPartVisibilityChange,
    attachPart
} from '@codingame/monaco-vscode-views-service-override';
import React, {useEffect, useRef} from "react";

export interface MonacoPartProps {
    part: Parts;
};

export const MonacoPart: React.FC<MonacoPartProps> = ({part}) => {
    const divRef = useRef<HTMLDivElement | null>(null);


    useEffect(() => {
        //Parts.

        if (!divRef.current) {
            return;
        }

        attachPart(part, divRef.current);
    }, []);
    return (
        <>
            <div ref={divRef} style={{ height: "100%", width: "100%" }} />
        </>
    );
};
