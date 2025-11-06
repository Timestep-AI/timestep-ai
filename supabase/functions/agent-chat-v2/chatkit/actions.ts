// ChatKit Actions - TypeScript equivalent of actions.py

export type Handler = "client" | "server";
export type LoadingBehavior = "auto" | "none" | "self" | "container";

export const DEFAULT_HANDLER: Handler = "server";
export const DEFAULT_LOADING_BEHAVIOR: LoadingBehavior = "auto";

export interface ActionConfig {
  type: string;
  payload?: any;
  handler: Handler;
  loadingBehavior: LoadingBehavior;
}

export class Action<TType extends string = string, TPayload = any> {
  type: TType;
  payload?: TPayload;

  constructor(type: TType, payload?: TPayload) {
    this.type = type;
    this.payload = payload;
  }

  static create<TPayload>(
    type: string,
    payload: TPayload,
    handler: Handler = DEFAULT_HANDLER,
    loadingBehavior: LoadingBehavior = DEFAULT_LOADING_BEHAVIOR
  ): ActionConfig {
    return {
      type,
      payload,
      handler,
      loadingBehavior,
    };
  }
}

