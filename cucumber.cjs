module.exports = {
  default: {
    import: ['tests/cucumber/steps/**/*.ts'],
    paths: ['tests/cucumber/features/**/*.feature'],
    format: ['progress', 'html:reports/cucumber-report.html'],
    publishQuiet: true,
    timeout: 60000,
    stepTimeout: 60000,
  },
};
