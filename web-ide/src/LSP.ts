import { BrowserMessageReader, BrowserMessageWriter } from "vscode-languageclient/browser";
import { WorkerComms } from "./main-thread";

export const getLSP = async () => {
    const worker = new Worker(new URL('./clangjs/language-server.worker.ts', import.meta.url), {
    type: 'module'
  })
  
    const comms = new WorkerComms(worker);

    await comms.waitForReady();
    //const reader = comms.getReader();
    //const writer = comms.getWriter();
    const reader = new BrowserMessageReader(worker);
    const writer = new BrowserMessageWriter(worker);
    return { worker, reader, writer };
}