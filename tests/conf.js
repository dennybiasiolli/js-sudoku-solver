exports.config = {
  framework: 'jasmine',

  // Protractor can test directly against Chrome and Firefox without using a Selenium Server
  directConnect: true,
  // To install and start the standalone Selenium Server manually,
  // use the webdriver-manager command line tool, which comes with Protractor.
  // seleniumAddress: 'http://localhost:4444/wd/hub',

  // To start the standalone Selenium Server from within your test script,
  // set these options in your config file:
  // seleniumServerJar: '../node_modules/protractor/node_modules/webdriver-manager/selenium/selenium-server-standalone-2.53.1.jar',

  specs: ['../tests/**/*.spec.js'],
  multiCapabilities: [{
    browserName: 'firefox'
  }, {
    browserName: 'chrome'
  }]
};
