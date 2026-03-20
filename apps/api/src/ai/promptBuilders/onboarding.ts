import { userInput, SYSTEM_JSON, type Prompt } from './utils.js';

export function buildOnboardingQuestionsPrompt(data: {
  projectName: string;
  projectDescription: string;
  existingTopics: string[];
}): Prompt {
  const existingLine =
    data.existingTopics.length > 0
      ? `\nThe following topics are already covered in the knowledge base — do NOT ask about them:\n${data.existingTopics.join(', ')}`
      : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate 3-6 contextual interview questions to help capture project knowledge for a software project.

Project name: ${userInput('project_name', data.projectName)}
Project description: ${userInput('project_description', data.projectDescription)}
${existingLine}

Each question should help an AI assistant understand the project better. Cover areas like:
- Tech stack and architecture patterns (category: "pattern")
- Coding conventions and standards (category: "pattern")
- Business domain and requirements (category: "business")
- Deployment and infrastructure (category: "integration")
- Testing approach and quality standards (category: "standard")
- External integrations and APIs (category: "integration")

Return a JSON object: { "questions": [{ "question": string, "context": string, "category": "standard" | "pattern" | "business" | "integration" }] }
"question" is the interview question. "context" is a brief hint explaining why this matters (shown to the user). "category" determines how the answer is classified in the knowledge base.
Generate between 3 and 6 questions. Skip any topics already covered.`,
  };
}
