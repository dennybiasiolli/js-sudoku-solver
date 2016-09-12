describe('sudoku resolver', function() {
  beforeEach(function() {
    browser.get('http://www.dennybiasiolli.com/angular-sudokuSolver/sudokuSolver.html');
  });

  it('should resolve sudoku', function(done) {
    inputNum = element.all(by.repeater('j in [0, 1, 2, 3, 4, 5, 6, 7, 8]'));
    expect(inputNum.count()).toBe(81);
    element(by.id('num_0_0')).sendKeys('1');
    element(by.id('num_0_8')).sendKeys('9');
    element(by.css('button.md-primary')).click();
    browser.switchTo().alert().then(function(alert) {
      alert.accept();
      expect(alert.getText()).toEqual('Completed!');
      done();
    });
  });
});
