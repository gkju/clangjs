import { Emitter, Event } from 'vscode-jsonrpc';

class MainThreadMessageReader {
    onData: (data: any) => void = () => {};
    onClose: () => void = () => {};

    private readonly emitter = new Emitter<Error>();
    get onError(): Event<Error> {
        return this.emitter.event;
    }

    constructor(private worker: Worker) {
      this.worker.addEventListener("message", (event) => {
        console.log("Received data from worker:", event.data);
        if (event.data && event.data?.type !== "ready") {
            this.onData(event.data);
        }
      });
    }
    listen(callback: (data: any) => void): void {
      this.onData = callback;
    }
    onPartialMessage: (data: any) => void = () => {};
    dispose(): void {
      this.worker.removeEventListener("message", this.onData);
    }
  }
  
class MainThreadMessageWriter {
    constructor(private worker: Worker) {}
    write(data: any): void {
        console.log("Writing data to worker:", data);
        this.worker.postMessage(data);
    }
    onClose: () => void = () => {};
    
    private readonly emitter = new Emitter<Error>();
    get onError(): Event<Error> {
        return this.emitter.event;
    }

    end(): void {
        this.onClose();
    }
    dispose(): void {
        this.worker.terminate();
    }
}

export class WorkerComms {
    private worker: Worker;
    private reader: MainThreadMessageReader;
    private writer: MainThreadMessageWriter;
    private readyPromise: Promise<void>;
    private resolveReady: () => void = () => {};

    constructor(worker: Worker) {
        this.worker = worker;
        this.reader = new MainThreadMessageReader(worker);
        this.writer = new MainThreadMessageWriter(worker);

        this.readyPromise = new Promise((resolve) => {
            this.resolveReady = resolve;
        });

        this.worker.addEventListener("message", (event) => {
            if (event.data && event.data.type === "ready") {
                this.resolveReady();
                this.resolveReady = () => {}; // Prevent multiple calls to resolveReady
            }
        }
    );
    }

    getReader(): MainThreadMessageReader {
        return this.reader;
    }

    getWriter(): MainThreadMessageWriter {
        return this.writer;
    }

    async waitForReady(): Promise<void> {
        return this.readyPromise;
    }

    dispose(): void {
        this.reader.dispose();
        this.writer.dispose();
    }
}