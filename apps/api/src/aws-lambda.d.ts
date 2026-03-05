declare module 'aws-lambda' {
  export interface APIGatewayProxyEvent {
    body: string | null;
    headers: Record<string, string | undefined>;
    httpMethod: string;
    path: string;
    pathParameters: Record<string, string> | null;
    queryStringParameters: Record<string, string> | null;
    requestContext: unknown;
    resource: string;
    stageVariables: Record<string, string> | null;
    isBase64Encoded: boolean;
    [key: string]: unknown;
  }

  export interface Context {
    callbackWaitsForEmptyEventLoop: boolean;
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: string;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    getRemainingTimeInMillis(): number;
    done(): void;
    fail(error: Error): void;
    succeed(messageOrEvent: unknown): void;
  }
}
