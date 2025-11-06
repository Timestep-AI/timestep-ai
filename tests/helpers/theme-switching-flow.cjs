// Theme switching flow - tests client tool calls
const themeSwitchingFlow = [
  {
    user: 'switch to the light theme',
    expectAssistant: /(switched|set).*light/i,
    expectToolCall: { name: 'switch_theme', theme: 'light' },
  },
  {
    user: 'and back',
    expectAssistant: /(switched|set|back).*dark/i,
    expectToolCall: { name: 'switch_theme', theme: 'dark' },
  },
];

module.exports = {
  themeSwitchingFlow,
};

