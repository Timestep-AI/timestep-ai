// Weather widget flow - tests weather tool with widget streaming
const weatherFlow = [
  {
    user: "What's the weather in Oakland and San Francisco?",
    // CRITICAL: Must have assistant message AFTER widgets with text about the weather
    // The assistant should describe/summarize the weather, not just show widgets
    expectAssistant: /weather|temperature|forecast|currently/i,
    expectAssistantMustNotBeOnlyWidget: true, // Ensure there's actual text, not just widget content
    // NOTE: Due to concurrent tool execution, widgets may render in either order
    // depending on which API call completes first. We verify both cities are present
    // but don't enforce order (this is expected behavior for async/parallel execution).
    expectWidgetsUnordered: [
      {
        type: 'weather',
        expectText: /Oakland/i,
        mustContain: 'Oakland',
      },
      {
        type: 'weather',
        expectText: /San Francisco/i,
        mustContain: 'San Francisco',
      },
    ],
  },
  {
    user: "and in Atlanta?",
    // CRITICAL: Must have assistant message AFTER widget with text about Atlanta weather
    expectAssistant: /weather|temperature|forecast|currently|Atlanta/i,
    expectAssistantMustNotBeOnlyWidget: true, // Ensure there's actual text, not just widget content
    expectWidget: {
      type: 'weather',
      expectText: /Atlanta/i,
    },
  },
  {
    user: "and in Berkeley?",
    // This should trigger the approval widget first
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
  {
    user: "and in New York?",
    // After the approval flow, normal conversation should continue
    // This should NOT require approval (New York is not Berkeley)
    expectAssistant: /weather|temperature|forecast|currently|New York/i,
    expectAssistantMustNotBeOnlyWidget: true, // Ensure there's actual text, not just widget content
    expectWidget: {
      type: 'weather',
      expectText: /New York/i,
    },
  },
];

module.exports = {
  weatherFlow,
};
