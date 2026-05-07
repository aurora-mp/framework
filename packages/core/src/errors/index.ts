export class AuroraError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public override readonly cause?: Error,
    ) {
        super(message);
        this.name = this.constructor.name;

        const captureStackTrace = (
            Error as unknown as {
                captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
            }
        ).captureStackTrace;

        if (typeof captureStackTrace === 'function') {
            captureStackTrace(this, this.constructor);
        }
    }
}

export class DuplicateProviderError extends AuroraError {
    constructor(token: string) {
        super(`Provider "${token}" is already registered`, 'DUPLICATE_PROVIDER');
    }
}

export class ProviderNotFoundError extends AuroraError {
    constructor(token: string, availableTokens: string) {
        super(`Provider "${token}" not found. Available: ${availableTokens}`, 'PROVIDER_NOT_FOUND');
    }
}
