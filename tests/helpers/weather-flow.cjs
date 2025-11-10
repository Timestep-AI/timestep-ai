// Weather widget flow - tests weather tool with widget streaming
const weatherFlow = [
  {
    user: "What's the weather in Oakland?",
    expectAssistant: /Oakland/i,
    expectWidget: {
      type: 'weather',
      expectText: /Oakland|temperature|weather|°/i,
    },
  },
];

module.exports = {
  weatherFlow,
};
