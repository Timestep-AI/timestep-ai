export class WidgetFactory {
  static createToolResultWidget(toolName: string, output: any): any {
    let outputText = 'Tool executed successfully.';
    if (output) {
      if (typeof output === 'string') {
        outputText = output;
      } else if (output.text) {
        outputText = String(output.text);
      } else {
        outputText = JSON.stringify(output);
      }
    }

    return {
      type: 'Card',
      size: 'sm',
      children: [
        {
          type: 'Row',
          align: 'center',
          gap: 3,
          children: [
            {
              type: 'Box',
              background: 'alpha-10',
              radius: 'sm',
              padding: 2,
              children: [
                {
                  type: 'Icon',
                  name: 'check-circle',
                  size: 'lg',
                },
              ],
            },
            {
              type: 'Col',
              gap: 0,
              children: [
                {
                  type: 'Title',
                  value: 'Tool Result',
                  size: 'sm',
                },
                {
                  type: 'Caption',
                  value: toolName,
                  color: 'secondary',
                },
              ],
            },
          ],
        },
        {
          type: 'Divider',
          flush: true,
        },
        {
          type: 'Text',
          value: outputText,
          wrap: true,
        },
      ],
    };
  }

  static createHandoffWidget(handoffName: string): any {
    return {
      type: 'Card',
      size: 'sm',
      children: [
        {
          type: 'Row',
          align: 'center',
          gap: 3,
          children: [
            {
              type: 'Box',
              background: 'alpha-10',
              radius: 'sm',
              padding: 2,
              children: [
                {
                  type: 'Icon',
                  name: 'arrow-right-circle',
                  size: 'lg',
                },
              ],
            },
            {
              type: 'Col',
              gap: 0,
              children: [
                {
                  type: 'Title',
                  value: 'Agent Transfer',
                  size: 'sm',
                },
                {
                  type: 'Caption',
                  value: `Transferring to ${handoffName}`,
                  color: 'secondary',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  static createHandoffResultWidget(output: any): any {
    let handoffOutputText = 'Transfer completed successfully.';
    if (output) {
      if (typeof output === 'string') {
        handoffOutputText = output;
      } else if (output.text) {
        handoffOutputText = String(output.text);
      } else {
        handoffOutputText = JSON.stringify(output);
      }
    }

    return {
      type: 'Card',
      size: 'sm',
      children: [
        {
          type: 'Row',
          align: 'center',
          gap: 3,
          children: [
            {
              type: 'Box',
              background: 'alpha-10',
              radius: 'sm',
              padding: 2,
              children: [
                {
                  type: 'Icon',
                  name: 'check-circle',
                  size: 'lg',
                },
              ],
            },
            {
              type: 'Col',
              gap: 0,
              children: [
                {
                  type: 'Title',
                  value: 'Transfer Complete',
                  size: 'sm',
                },
                {
                  type: 'Caption',
                  value: 'Successfully transferred to target agent',
                  color: 'secondary',
                },
              ],
            },
          ],
        },
        {
          type: 'Divider',
          flush: true,
        },
        {
          type: 'Text',
          value: handoffOutputText,
          wrap: true,
        },
      ],
    };
  }

  static createToolApprovalWidget(
    toolName: string,
    argumentsText: string,
    toolCallId: string,
    approvalItemId: string
  ): any {
    return {
      type: 'Card',
      size: 'sm',
      confirm: {
        label: 'Approve',
        action: {
          type: 'approve_tool_call',
          toolCallId: toolCallId,
          item_id: approvalItemId,
          payload: {
            tool_call_id: toolCallId,
          },
        },
      },
      cancel: {
        label: 'Deny',
        action: {
          type: 'reject_tool_call',
          toolCallId: toolCallId,
          item_id: approvalItemId,
          payload: {
            tool_call_id: toolCallId,
          },
        },
      },
      children: [
        {
          type: 'Row',
          align: 'center',
          gap: 3,
          children: [
            {
              type: 'Box',
              background: 'alpha-10',
              radius: 'sm',
              padding: 2,
              children: [
                {
                  type: 'Icon',
                  name: 'square-code',
                  size: 'lg',
                },
              ],
            },
            {
              type: 'Col',
              gap: 0,
              children: [
                {
                  type: 'Title',
                  value: 'Tool approval required',
                  size: 'sm',
                },
                {
                  type: 'Caption',
                  value: toolName,
                  color: 'secondary',
                },
              ],
            },
          ],
        },
        {
          type: 'Divider',
          flush: true,
        },
        {
          type: 'Col',
          gap: 2,
          children: [
            {
              type: 'Caption',
              value: 'Arguments',
              color: 'secondary',
            },
            ...Object.entries(JSON.parse(argumentsText || '{}')).map(([key, value]) => ({
              type: 'Row',
              gap: 2,
              children: [
                {
                  type: 'Badge',
                  label: key,
                },
                {
                  type: 'Text',
                  value: String(value),
                  size: 'sm',
                },
              ],
            })),
            {
              type: 'Text',
              value: `May send ${toolName} request to external service.`,
              size: 'xs',
              color: 'tertiary',
            },
          ],
        },
      ],
    };
  }
}
