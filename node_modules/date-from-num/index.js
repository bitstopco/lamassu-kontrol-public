module.exports = function(num) {
  if (num < 252489600000) num *= 1000
  return new Date(num)
}
