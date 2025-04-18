import {EventEmitter} from 'events'

export type CommandDataEvent = {
    data: string
    type: 'stdin' | 'stdout' | 'stderr'
}

export class CommandIO {
    private readonly emitter = new EventEmitter();
    private _disposed = false;

    constructor() {
        console.log('CommandIO created');
    }

    // Write to command's stdin
    writeInput(data: string): void {
        if (this._disposed) return;
        this.emitter.emit('stdin', data);
        this.emitter.emit('data', {data, type: 'stdin'});
    }

    // Write to command's stdout
    writeOutput(data: string): void {
        if (this._disposed) return;
        this.emitter.emit('stdout', data);
        this.emitter.emit('data', {data, type: 'stdout'});
    }

    // Write to command's stderr
    writeError(data: string): void {
        if (this._disposed) return;
        this.emitter.emit('stderr', data);
        this.emitter.emit('data', {data, type: 'stderr'});
    }

    // Event listeners
    onStdin(callback: (data: string) => void): () => void {
        if (this._disposed) return () => {
        };
        this.emitter.on('stdin', callback);
        return () => this.emitter.off('stdin', callback);
    }

    onStdout(callback: (data: string) => void): () => void {
        if (this._disposed) return () => {
        };
        this.emitter.on('stdout', callback);
        return () => this.emitter.off('stdout', callback);
    }

    onStderr(callback: (data: string) => void): () => void {
        if (this._disposed) return () => {
        };
        this.emitter.on('stderr', callback);
        return () => this.emitter.off('stderr', callback);
    }

    onData(callback: (event: CommandDataEvent) => void): () => void {
        if (this._disposed) return () => {
        };
        this.emitter.on('data', callback);
        return () => this.emitter.off('data', callback);
    }

    // Dispose resources
    dispose(): void {
        this._disposed = true;
        this.emitter.removeAllListeners();
    }
}