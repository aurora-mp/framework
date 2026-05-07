export interface WebviewRpcRequest {
    id: string;
    name: string;
    args: unknown[];
}

export interface WebviewRpcResponse {
    id: string;
    result?: unknown;
    error?: string;
}
