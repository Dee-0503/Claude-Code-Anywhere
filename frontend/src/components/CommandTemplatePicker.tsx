import type { ReactElement } from "react";

export interface CommandTemplate {
  readonly id: string;
  readonly label: string;
  readonly template: string;
}

export function renderCommandTemplatePicker(templates: readonly CommandTemplate[]): string {
  if (templates.length === 0) {
    return "没有可用的命令模板。";
  }

  return templates.map((template) => `${template.label}：${template.template}`).join("；");
}

export interface CommandTemplatePickerProps {
  readonly templates: readonly CommandTemplate[];
  readonly onSelect?: (template: CommandTemplate) => void;
}

export function CommandTemplatePicker({ templates, onSelect }: CommandTemplatePickerProps): ReactElement {
  return (
    <section aria-label="命令模板">
      <p>{renderCommandTemplatePicker(templates)}</p>
      {templates.map((template) => (
        <button key={template.id} type="button" onClick={() => onSelect?.(template)}>
          {template.label}
        </button>
      ))}
    </section>
  );
}
