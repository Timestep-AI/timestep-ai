/** Widget for tool approval requests in human-in-the-loop scenarios. */

import type { Box, WidgetRoot } from '../_shared/chatkit/widgets.ts';
import type { ActionConfig } from '../_shared/chatkit/actions.ts';

export function renderApprovalWidget(
  agentName: string,
  toolName: string,
  toolArguments: Record<string, any>,
  interruptionId?: string | null,
): WidgetRoot {
  /** Build an approval widget for tool calls requiring human approval.
   * 
   * Matches Python render_approval_widget implementation
   */
  // Format arguments for display
  const argsText = Object.entries(toolArguments)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  
  const header: Box = {
    type: 'Box',
    padding: 5,
    background: 'surface-tertiary',
    children: [
      {
        type: 'Col',
        gap: 2,
        children: [
          {
            type: 'Title',
            value: 'Approval Required',
            size: 'md',
            weight: 'semibold',
          },
          {
            type: 'Text',
            value: `Agent ${agentName} wants to use the tool ${toolName}`,
            color: 'secondary',
            size: 'sm',
          },
        ],
      },
    ],
  };
  
  const body: Box = {
    type: 'Box',
    padding: 5,
    gap: 4,
    children: [
      {
        type: 'Col',
        gap: 3,
        children: [
          {
            type: 'Text',
            value: 'Tool Details',
            weight: 'semibold',
            size: 'sm',
          },
          {
            type: 'Box',
            padding: 3,
            radius: 'md',
            background: 'surface-secondary',
            children: [
              {
                type: 'Col',
                gap: 2,
                children: [
                  {
                    type: 'Row',
                    gap: 2,
                    children: [
                      {
                        type: 'Text',
                        value: 'Tool:',
                        weight: 'medium',
                        size: 'sm',
                        color: 'tertiary',
                      },
                      {
                        type: 'Text',
                        value: toolName,
                        weight: 'semibold',
                        size: 'sm',
                      },
                    ],
                  },
                  {
                    type: 'Row',
                    gap: 2,
                    align: 'start',
                    children: [
                      {
                        type: 'Text',
                        value: 'Arguments:',
                        weight: 'medium',
                        size: 'sm',
                        color: 'tertiary',
                      },
                      {
                        type: 'Text',
                        value: argsText || 'None',
                        size: 'sm',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'Text',
            value: 'Please approve or reject this tool call to continue.',
            color: 'tertiary',
            size: 'xs',
          },
        ],
      },
    ],
  };
  
  return {
    type: 'Card',
    key: `approval_${interruptionId || 'pending'}`,
    padding: 0,
    children: [header, body],
    cancel: {
      label: 'Reject',
      action: {
        type: 'tool_approval',
        payload: {
          action: 'reject',
          interruption_id: interruptionId,
          tool_name: toolName,
          tool_arguments: toolArguments,
        },
        handler: 'server',
        loadingBehavior: 'auto',
      } as ActionConfig,
    },
    confirm: {
      label: 'Approve',
      action: {
        type: 'tool_approval',
        payload: {
          action: 'approve',
          interruption_id: interruptionId,
          tool_name: toolName,
          tool_arguments: toolArguments,
        },
        handler: 'server',
        loadingBehavior: 'auto',
      } as ActionConfig,
    },
  };
}

export function approvalWidgetCopyText(
  agentName: string,
  toolName: string,
  toolArguments: Record<string, any>,
): string {
  /** Generate human-readable fallback text for the approval widget.
   * 
   * Matches Python approval_widget_copy_text implementation
   */
  const argsText = Object.entries(toolArguments)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `Approval required: Agent ${agentName} wants to use tool ${toolName} with arguments: ${argsText}`;
}

