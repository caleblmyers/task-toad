// ── Auth Queries & Mutations ──

export const MY_PERMISSIONS_QUERY = `query MyPermissions($projectId: ID!) {
  myPermissions(projectId: $projectId)
}`;

export const ME_QUERY = `query { me { userId email orgId role emailVerifiedAt orgPlan githubLogin } }`;

export const LOGIN_MUTATION = `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) { token }
}`;

export const SIGNUP_MUTATION = `mutation Signup($email: String!, $password: String!) {
  signup(email: $email, password: $password)
}`;

export const LOGOUT_MUTATION = `mutation Logout { logout }`;

export const ME_PROFILE_QUERY = `query MeProfile {
  me { userId email displayName avatarUrl timezone }
}`;

export const UPDATE_PROFILE_MUTATION = `mutation UpdateProfile($displayName: String, $avatarUrl: String, $timezone: String) {
  updateProfile(displayName: $displayName, avatarUrl: $avatarUrl, timezone: $timezone) {
    email displayName avatarUrl timezone
  }
}`;

// ── Org ──

export const ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint promptLoggingEnabled plan licenseFeatures } }`;

export const ORG_USERS_QUERY = `query OrgUsers { orgUsers { userId email displayName role } }`;

export const ORG_INVITES_QUERY = `query { orgInvites { inviteId email role expiresAt createdAt } }`;

export const SET_ORG_API_KEY_MUTATION = `mutation SetOrgApiKey($apiKey: String!, $confirmPassword: String!) { setOrgApiKey(apiKey: $apiKey, confirmPassword: $confirmPassword) { orgId name hasApiKey apiKeyHint } }`;

export const INVITE_ORG_MEMBER_MUTATION = `mutation InviteOrgMember($email: String!, $role: String) {
  inviteOrgMember(email: $email, role: $role)
}`;

export const REVOKE_INVITE_MUTATION = `mutation RevokeInvite($inviteId: ID!) { revokeInvite(inviteId: $inviteId) }`;

export const SET_PROMPT_LOGGING_MUTATION = `mutation SetAIBudget($promptLoggingEnabled: Boolean) { setAIBudget(promptLoggingEnabled: $promptLoggingEnabled) { orgId name hasApiKey apiKeyHint promptLoggingEnabled } }`;
