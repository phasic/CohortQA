declare module 'prompts' {
  export interface PromptOptions {
    type: string;
    name: string;
    message: string;
    initial?: any;
    choices?: Array<{ title: string; value: any }>;
    validate?: (value: any) => boolean | string | Promise<boolean | string>;
    min?: number;
    max?: number;
  }

  export default function prompts(
    questions: PromptOptions | PromptOptions[],
    options?: any
  ): Promise<Record<string, any>>;
}

