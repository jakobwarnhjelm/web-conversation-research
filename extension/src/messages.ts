/** Meddelanden mellan flow-sidan och service workern. */
export interface CaptureUrlRequest {
  type: "tabflow:captureUrl";
  url: string;
}

export interface CaptureResult {
  imageRef: string;
  textHtmlRef: string;
  title: string;
  capturedAt: string;
}

export type Request = CaptureUrlRequest;
