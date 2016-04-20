var test = require('tape')
var dateFromNum = require('./')

test(function(t) {
  t.plan(1)

  t.equal(
    dateFromNum(1409759012000).getTime(),
    dateFromNum(1409759012).getTime()
  )
})
