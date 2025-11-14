"""Widget for tool approval requests in human-in-the-loop scenarios."""

from chatkit.widgets import Box, Card, Col, Row, Text, Title, WidgetRoot
from chatkit.actions import ActionConfig


def render_approval_widget(
    agent_name: str,
    tool_name: str,
    tool_arguments: dict[str, any],
    interruption_id: str | None = None,
) -> WidgetRoot:
    """Build an approval widget for tool calls requiring human approval.
    
    Args:
        agent_name: Name of the agent requesting approval
        tool_name: Name of the tool being called
        tool_arguments: Arguments for the tool call
        interruption_id: Optional ID for the interruption (for tracking)
    
    Returns:
        WidgetRoot with approval UI
    """
    # Format arguments for display
    args_text = ", ".join(f"{k}={v}" for k, v in tool_arguments.items())
    
    header = Box(
        padding=5,
        background="surface-tertiary",
        children=[
            Col(
                gap=2,
                children=[
                    Title(
                        value="Approval Required",
                        size="md",
                        weight="semibold",
                    ),
                    Text(
                        value=f"Agent {agent_name} wants to use the tool {tool_name}",
                        color="secondary",
                        size="sm",
                    ),
                ],
            ),
        ],
    )
    
    body = Box(
        padding=5,
        gap=4,
        children=[
            Col(
                gap=3,
                children=[
                    Text(
                        value="Tool Details",
                        weight="semibold",
                        size="sm",
                    ),
                    Box(
                        padding=3,
                        radius="md",
                        background="surface-secondary",
                        children=[
                            Col(
                                gap=2,
                                children=[
                                    Row(
                                        gap=2,
                                        children=[
                                            Text(
                                                value="Tool:",
                                                weight="medium",
                                                size="sm",
                                                color="tertiary",
                                            ),
                                            Text(
                                                value=tool_name,
                                                weight="semibold",
                                                size="sm",
                                            ),
                                        ],
                                    ),
                                    Row(
                                        gap=2,
                                        align="start",
                                        children=[
                                            Text(
                                                value="Arguments:",
                                                weight="medium",
                                                size="sm",
                                                color="tertiary",
                                            ),
                                            Text(
                                                value=args_text or "None",
                                                size="sm",
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                    Text(
                        value="Please approve or reject this tool call to continue.",
                        color="tertiary",
                        size="xs",
                    ),
                ],
            ),
        ],
    )
    
    return Card(
        key=f"approval_{interruption_id or 'pending'}",
        padding=0,
        children=[header, body],
        cancel={
            "label": "Reject",
            "action": ActionConfig(
                type="tool_approval",
                payload={
                    "action": "reject",
                    "interruption_id": interruption_id,
                    "tool_name": tool_name,
                    "tool_arguments": tool_arguments,
                },
                handler="server",
                loadingBehavior="auto",
            ),
        },
        confirm={
            "label": "Approve",
            "action": ActionConfig(
                type="tool_approval",
                payload={
                    "action": "approve",
                    "interruption_id": interruption_id,
                    "tool_name": tool_name,
                    "tool_arguments": tool_arguments,
                },
                handler="server",
                loadingBehavior="auto",
            ),
        },
    )


def approval_widget_copy_text(
    agent_name: str,
    tool_name: str,
    tool_arguments: dict[str, any],
) -> str:
    """Generate human-readable fallback text for the approval widget."""
    args_text = ", ".join(f"{k}={v}" for k, v in tool_arguments.items())
    return f"Approval required: Agent {agent_name} wants to use tool {tool_name} with arguments: {args_text}"

