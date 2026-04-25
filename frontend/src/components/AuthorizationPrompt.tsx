import type { ReactElement } from "react";

export interface AuthorizationPromptState {
  readonly title: string;
  readonly body: string;
  readonly status: "waiting" | "resolved";
}

export function renderAuthorizationPrompt(prompt: AuthorizationPromptState): string {
  if (prompt.status === "resolved") {
    return "授权结果已同步。";
  }
  return `${prompt.title}：${prompt.body}。请在终端原生审批提示中操作。`;
}

export interface AuthorizationPromptProps {
  readonly prompt: AuthorizationPromptState;
}

export function AuthorizationPrompt({ prompt }: AuthorizationPromptProps): ReactElement {
  return (
    <section aria-label="授权审批提示">
      <p>{renderAuthorizationPrompt(prompt)}</p>
    </section>
  );
}
