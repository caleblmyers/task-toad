import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const TableName = process.env.TABLE_NAME ?? 'PmAppTable';

function pkOrg(orgId: string) {
  return `ORG#${orgId}`;
}
function skUser(userId: string) {
  return `USER#${userId}`;
}
function skProject(projectId: string) {
  return `PROJECT#${projectId}`;
}
function skTask(taskId: string) {
  return `TASK#${taskId}`;
}

export interface OrgRecord {
  PK: string;
  SK: string;
  name: string;
  createdAt: string;
  entity: 'ORG';
}
export interface UserRecord {
  PK: string;
  SK: string;
  email: string;
  role: string;
  entity: 'USER';
}
export interface ProjectRecord {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  name: string;
  projectId: string;
  createdAt: string;
  entity: 'PROJECT';
}
export interface TaskRecord {
  PK: string;
  SK: string;
  GSI2PK: string;
  GSI2SK: string;
  title: string;
  status: string;
  projectId: string;
  taskId: string;
  createdAt: string;
  entity: 'TASK';
}

export async function getOrg(orgId: string): Promise<OrgRecord | null> {
  const r = await client.send(
    new GetItemCommand({
      TableName,
      Key: marshall({ PK: pkOrg(orgId), SK: 'META' }),
    })
  );
  if (!r.Item) return null;
  return unmarshall(r.Item) as OrgRecord;
}

export async function putOrg(orgId: string, name: string): Promise<void> {
  const createdAt = new Date().toISOString();
  await client.send(
    new PutItemCommand({
      TableName,
      Item: marshall({
        PK: pkOrg(orgId),
        SK: 'META',
        name,
        createdAt,
        entity: 'ORG',
      }),
    })
  );
}

export async function putUser(orgId: string, userId: string, email: string, role: string): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName,
      Item: marshall({
        PK: pkOrg(orgId),
        SK: skUser(userId),
        email,
        role,
        entity: 'USER',
      }),
    })
  );
}

export async function getUser(orgId: string, userId: string): Promise<UserRecord | null> {
  const r = await client.send(
    new GetItemCommand({
      TableName,
      Key: marshall({ PK: pkOrg(orgId), SK: skUser(userId) }),
    })
  );
  if (!r.Item) return null;
  return unmarshall(r.Item) as UserRecord;
}

export async function listProjects(orgId: string): Promise<ProjectRecord[]> {
  const r = await client.send(
    new QueryCommand({
      TableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: marshall({ ':pk': pkOrg(orgId) }),
      ScanIndexForward: false,
    })
  );
  return (r.Items ?? []).map((i) => unmarshall(i) as ProjectRecord);
}

export async function getProject(orgId: string, projectId: string): Promise<ProjectRecord | null> {
  const r = await client.send(
    new GetItemCommand({
      TableName,
      Key: marshall({ PK: pkOrg(orgId), SK: skProject(projectId) }),
    })
  );
  if (!r.Item) return null;
  return unmarshall(r.Item) as ProjectRecord;
}

export async function putProject(orgId: string, projectId: string, name: string): Promise<void> {
  const createdAt = new Date().toISOString();
  const GSI1SK = `PROJECT#${createdAt}#${projectId}`;
  await client.send(
    new PutItemCommand({
      TableName,
      Item: marshall({
        PK: pkOrg(orgId),
        SK: skProject(projectId),
        GSI1PK: pkOrg(orgId),
        GSI1SK,
        name,
        projectId,
        createdAt,
        entity: 'PROJECT',
      }),
    })
  );
}

export async function listTasks(orgId: string, projectId: string): Promise<TaskRecord[]> {
  const GSI2PK = `ORG#${orgId}#PROJECT#${projectId}`;
  const r = await client.send(
    new QueryCommand({
      TableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
      ExpressionAttributeValues: marshall({ ':pk': GSI2PK, ':sk': 'TASK#' }),
      ScanIndexForward: false,
    })
  );
  return (r.Items ?? []).map((i) => unmarshall(i) as TaskRecord);
}

export async function getTask(orgId: string, taskId: string): Promise<TaskRecord | null> {
  const r = await client.send(
    new GetItemCommand({
      TableName,
      Key: marshall({ PK: pkOrg(orgId), SK: skTask(taskId) }),
    })
  );
  if (!r.Item) return null;
  return unmarshall(r.Item) as TaskRecord;
}

export async function putTask(
  orgId: string,
  taskId: string,
  projectId: string,
  title: string,
  status: string
): Promise<void> {
  const createdAt = new Date().toISOString();
  const GSI2PK = `ORG#${orgId}#PROJECT#${projectId}`;
  const GSI2SK = `TASK#${createdAt}#${taskId}`;
  await client.send(
    new PutItemCommand({
      TableName,
      Item: marshall({
        PK: pkOrg(orgId),
        SK: skTask(taskId),
        GSI2PK,
        GSI2SK,
        title,
        status,
        projectId,
        taskId,
        createdAt,
        entity: 'TASK',
      }),
    })
  );
}

export async function updateTask(
  orgId: string,
  taskId: string,
  updates: { title?: string; status?: string }
): Promise<TaskRecord | null> {
  const task = await getTask(orgId, taskId);
  if (!task) return null;
  const title = updates.title ?? task.title;
  const status = updates.status ?? task.status;
  const createdAt = task.createdAt;
  const GSI2PK = `ORG#${orgId}#PROJECT#${task.projectId}`;
  const GSI2SK = `TASK#${createdAt}#${taskId}`;
  await client.send(
    new PutItemCommand({
      TableName,
      Item: marshall({
        ...task,
        title,
        status,
        GSI2PK,
        GSI2SK,
      }),
    })
  );
  return { ...task, title, status };
}
