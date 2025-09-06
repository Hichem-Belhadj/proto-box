export type ErrorCode =
    "INVALID_ZIP_FILE"
    | "EMPTY_ZIP_FILE"
    | "SEND_INVALID_URL"
    | "SEND_INVALID_PAYLOAD"
    | "SEND_INVALID_HEADER"
    | "SEND_PROXY_ERROR";

export type ErrorModel = {
    code: ErrorCode;
    message?: string;
}