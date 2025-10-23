module.exports = {
  default: {
    require: ['tests/cucumber/steps/**/*.cjs'],
    paths: ['tests/cucumber/features/**/*.feature'],
    format: ['progress', 'html:reports/cucumber-report.html'],
    publishQuiet: true,
    timeout: 60000,
    stepTimeout: 60000,
    parallel: 2, // Run both scenarios in parallel to expose interference
  },
};
