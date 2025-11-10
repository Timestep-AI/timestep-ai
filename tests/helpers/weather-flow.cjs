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
];

module.exports = {
  weatherFlow,
};
