import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import * as path from 'path';

export class TaskToadStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'task-toad-users',
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      customAttributes: {
        org_id: new cognito.StringAttribute({ minLen: 1, maxLen: 36, mutable: true }),
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
    });

    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    const table = new dynamodb.Table(this, 'PmAppTable', {
      tableName: 'PmAppTable',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // From infra/dist/lib, go up to repo root (3 levels). Use repo root as projectRoot
    // so pnpm-lock.yaml is under projectRoot (required by NodejsFunction bundling).
    const repoRoot = path.join(__dirname, '..', '..', '..');
    const apiEntry = path.join(repoRoot, 'apps', 'api', 'src', 'index.ts');
    const apiHandler = new lambdaNode.NodejsFunction(this, 'ApiHandler', {
      entry: apiEntry,
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      projectRoot: repoRoot,
      environment: {
        TABLE_NAME: table.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_REGION: this.region,
      },
      timeout: cdk.Duration.seconds(30),
      bundling: { minify: true },
    });
    table.grantReadWriteData(apiHandler);
    userPool.grant(apiHandler, 'cognito-idp:AdminUpdateUserAttributes');

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'TaskToad API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'Auth', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    const proxy = api.root.addResource('{proxy+}');
    proxy.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(apiHandler, { proxy: true }),
      { authorizer: auth }
    );
    api.root.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(apiHandler, { proxy: true }),
      { authorizer: auth }
    );

    new s3.Bucket(this, 'Storage', {
      bucketName: undefined,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    new events.EventBus(this, 'TaskToadBus', {
      eventBusName: 'task-toad-events',
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId, description: 'Cognito User Pool ID' });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito Client ID',
    });
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName, description: 'DynamoDB Table' });
  }
}
