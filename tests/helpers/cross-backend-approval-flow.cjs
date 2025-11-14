// Cross-backend approval flow - tests run state compatibility
// This flow starts with one backend, gets approval widget, switches backend, then approves

// Flow: Start with TypeScript, get approval widget, switch to Python, then approve
const crossBackendApprovalFlowTS = [
  {
    user: "What's the weather in Berkeley?",
    // Wait for approval widget but don't approve yet
    expectApprovalWidgetOnly: {
      expectText: /approval|Berkeley|get_weather/i,
    },
    // Switch to Python backend
    switchBackend: "Python",
    // After backend switch, approve the widget
    expectApprovalWidget: {
      expectText: /approval|Berkeley|get_weather/i,
    },
    // After approval, expect the weather widget
    expectWidgetAfterApproval: {
      type: 'weather',
      expectText: /Berkeley/i,
    },
    // After approval, expect assistant message with weather info
    expectAssistantAfterApproval: /weather|temperature|forecast|currently|Berkeley/i,
    expectAssistantMustNotBeOnlyWidget: true, // Ensure there's actual text, not just widget content
  },
];

// Flow: Start with Python, get approval widget, switch to TypeScript, then approve
const crossBackendApprovalFlowPython = [
  {
    user: "What's the weather in Berkeley?",
    // Wait for approval widget but don't approve yet
    expectApprovalWidgetOnly: {
      expectText: /approval|Berkeley|get_weather/i,
    },
    // Switch to TypeScript backend
    switchBackend: "TypeScript",
    // After backend switch, approve the widget
    expectApprovalWidget: {
      expectText: /approval|Berkeley|get_weather/i,
    },
    // After approval, expect the weather widget
    expectWidgetAfterApproval: {
      type: 'weather',
      expectText: /Berkeley/i,
    },
    // After approval, expect assistant message with weather info
    expectAssistantAfterApproval: /weather|temperature|forecast|currently|Berkeley/i,
    expectAssistantMustNotBeOnlyWidget: true, // Ensure there's actual text, not just widget content
  },
];

module.exports = {
  crossBackendApprovalFlowTS,
  crossBackendApprovalFlowPython,
};

