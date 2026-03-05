#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TaskToadStack } from '../lib/task-toad-stack.js';

const app = new cdk.App();
new TaskToadStack(app, 'TaskToadStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
