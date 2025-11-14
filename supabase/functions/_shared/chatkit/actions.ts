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

  // Note: In Python, Action.create() is a classmethod that infers type from the Action class
  // For generic actions, use ActionConfig directly instead
  // This method signature matches Python but requires a typed Action subclass to work properly
  static create<TPayload>(
    payload: TPayload,
    handler: Handler = DEFAULT_HANDLER,
    loadingBehavior: LoadingBehavior = DEFAULT_LOADING_BEHAVIOR
  ): ActionConfig {
    // In Python, the type is inferred from the Action class's Literal type parameter
    // In TypeScript, we can't easily do this, so this method should only be used
    // with typed Action subclasses. For generic actions, use ActionConfig directly.
    throw new Error(
      "Action.create() should not be called on generic Action. Use ActionConfig directly or create a typed Action subclass."
    );
  }
}

