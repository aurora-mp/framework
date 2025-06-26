/**
 * Minimal cross-platform abstraction for a browser-based UI instance.
 * Mirrors common APIs for alt:V, RageMP, etc.
 */
export interface IWebView {
    emit(event: string, ...args: unknown[]): void;

    destroy(): void;

    //create(id: string | number, url: string, focused: boolean): IWebView;
    //destroy(id: string | number): void;
    // readonly id: string | number;
    //on(eventName: string, listener: (...args: unknown[]) => void): void;
    //emit(eventName: string, ...args: unknown[]): void;
    // ToDo
    //destroy(): void;
    //focus?(): void;
    //unfocus?(): void;
}
